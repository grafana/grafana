// Copyright 2012 The Freetype-Go Authors. All rights reserved.
// Use of this source code is governed by your choice of either the
// FreeType License or the GNU General Public License version 2 (or
// any later version), both of which can be found in the LICENSE file.

package truetype

import (
	"reflect"
	"strings"
	"testing"
)

func TestBytecode(t *testing.T) {
	testCases := []struct {
		desc   string
		prog   []byte
		want   []int32
		errStr string
	}{
		{
			"underflow",
			[]byte{
				opDUP,
			},
			nil,
			"underflow",
		},
		{
			"infinite loop",
			[]byte{
				opPUSHW000, // [-1]
				0xff,
				0xff,
				opDUP,  // [-1, -1]
				opJMPR, // [-1]
			},
			nil,
			"too many steps",
		},
		{
			"unbalanced if/else",
			[]byte{
				opPUSHB000, // [0]
				0,
				opIF,
			},
			nil,
			"unbalanced",
		},
		{
			"vector set/gets",
			[]byte{
				opSVTCA1,   // []
				opGPV,      // [0x4000, 0]
				opSVTCA0,   // [0x4000, 0]
				opGFV,      // [0x4000, 0, 0, 0x4000]
				opNEG,      // [0x4000, 0, 0, -0x4000]
				opSPVFS,    // [0x4000, 0]
				opSFVTPV,   // [0x4000, 0]
				opPUSHB000, // [0x4000, 0, 1]
				1,
				opGFV,      // [0x4000, 0, 1, 0, -0x4000]
				opPUSHB000, // [0x4000, 0, 1, 0, -0x4000, 2]
				2,
			},
			[]int32{0x4000, 0, 1, 0, -0x4000, 2},
			"",
		},
		{
			"jumps",
			[]byte{
				opPUSHB001, // [10, 2]
				10,
				2,
				opJMPR,     // [10]
				opDUP,      // not executed
				opDUP,      // [10, 10]
				opPUSHB010, // [10, 10, 20, 2, 1]
				20,
				2,
				1,
				opJROT,     // [10, 10, 20]
				opDUP,      // not executed
				opDUP,      // [10, 10, 20, 20]
				opPUSHB010, // [10, 10, 20, 20, 30, 2, 1]
				30,
				2,
				1,
				opJROF, // [10, 10, 20, 20, 30]
				opDUP,  // [10, 10, 20, 20, 30, 30]
				opDUP,  // [10, 10, 20, 20, 30, 30, 30]
			},
			[]int32{10, 10, 20, 20, 30, 30, 30},
			"",
		},
		{
			"stack ops",
			[]byte{
				opPUSHB010, // [10, 20, 30]
				10,
				20,
				30,
				opCLEAR,    // []
				opPUSHB010, // [40, 50, 60]
				40,
				50,
				60,
				opSWAP,     // [40, 60, 50]
				opDUP,      // [40, 60, 50, 50]
				opDUP,      // [40, 60, 50, 50, 50]
				opPOP,      // [40, 60, 50, 50]
				opDEPTH,    // [40, 60, 50, 50, 4]
				opCINDEX,   // [40, 60, 50, 50, 40]
				opPUSHB000, // [40, 60, 50, 50, 40, 4]
				4,
				opMINDEX, // [40, 50, 50, 40, 60]
			},
			[]int32{40, 50, 50, 40, 60},
			"",
		},
		{
			"push ops",
			[]byte{
				opPUSHB000, // [255]
				255,
				opPUSHW001, // [255, -2, 253]
				255,
				254,
				0,
				253,
				opNPUSHB, // [1, -2, 253, 1, 2]
				2,
				1,
				2,
				opNPUSHW, // [1, -2, 253, 1, 2, 0x0405, 0x0607, 0x0809]
				3,
				4,
				5,
				6,
				7,
				8,
				9,
			},
			[]int32{255, -2, 253, 1, 2, 0x0405, 0x0607, 0x0809},
			"",
		},
		{
			"store ops",
			[]byte{
				opPUSHB011, // [1, 22, 3, 44]
				1,
				22,
				3,
				44,
				opWS,       // [1, 22]
				opWS,       // []
				opPUSHB000, // [3]
				3,
				opRS, // [44]
			},
			[]int32{44},
			"",
		},
		{
			"comparison ops",
			[]byte{
				opPUSHB001, // [10, 20]
				10,
				20,
				opLT,       // [1]
				opPUSHB001, // [1, 10, 20]
				10,
				20,
				opLTEQ,     // [1, 1]
				opPUSHB001, // [1, 1, 10, 20]
				10,
				20,
				opGT,       // [1, 1, 0]
				opPUSHB001, // [1, 1, 0, 10, 20]
				10,
				20,
				opGTEQ, // [1, 1, 0, 0]
				opEQ,   // [1, 1, 1]
				opNEQ,  // [1, 0]
			},
			[]int32{1, 0},
			"",
		},
		{
			"odd/even",
			// Calculate odd(2+31/64), odd(2+32/64), even(2), even(1).
			[]byte{
				opPUSHB000, // [159]
				159,
				opODD,      // [0]
				opPUSHB000, // [0, 160]
				160,
				opODD,      // [0, 1]
				opPUSHB000, // [0, 1, 128]
				128,
				opEVEN,     // [0, 1, 1]
				opPUSHB000, // [0, 1, 1, 64]
				64,
				opEVEN, // [0, 1, 1, 0]
			},
			[]int32{0, 1, 1, 0},
			"",
		},
		{
			"if true",
			[]byte{
				opPUSHB001, // [255, 1]
				255,
				1,
				opIF,
				opPUSHB000, // [255, 2]
				2,
				opEIF,
				opPUSHB000, // [255, 2, 254]
				254,
			},
			[]int32{255, 2, 254},
			"",
		},
		{
			"if false",
			[]byte{
				opPUSHB001, // [255, 0]
				255,
				0,
				opIF,
				opPUSHB000, // [255]
				2,
				opEIF,
				opPUSHB000, // [255, 254]
				254,
			},
			[]int32{255, 254},
			"",
		},
		{
			"if/else true",
			[]byte{
				opPUSHB000, // [1]
				1,
				opIF,
				opPUSHB000, // [2]
				2,
				opELSE,
				opPUSHB000, // not executed
				3,
				opEIF,
			},
			[]int32{2},
			"",
		},
		{
			"if/else false",
			[]byte{
				opPUSHB000, // [0]
				0,
				opIF,
				opPUSHB000, // not executed
				2,
				opELSE,
				opPUSHB000, // [3]
				3,
				opEIF,
			},
			[]int32{3},
			"",
		},
		{
			"if/else true if/else false",
			// 0x58 is the opcode for opIF. The literal 0x58s below are pushed data.
			[]byte{
				opPUSHB010, // [255, 0, 1]
				255,
				0,
				1,
				opIF,
				opIF,
				opPUSHB001, // not executed
				0x58,
				0x58,
				opELSE,
				opPUSHW000, // [255, 0x5858]
				0x58,
				0x58,
				opEIF,
				opELSE,
				opIF,
				opNPUSHB, // not executed
				3,
				0x58,
				0x58,
				0x58,
				opELSE,
				opNPUSHW, // not executed
				2,
				0x58,
				0x58,
				0x58,
				0x58,
				opEIF,
				opEIF,
				opPUSHB000, // [255, 0x5858, 254]
				254,
			},
			[]int32{255, 0x5858, 254},
			"",
		},
		{
			"if/else false if/else true",
			// 0x58 is the opcode for opIF. The literal 0x58s below are pushed data.
			[]byte{
				opPUSHB010, // [255, 1, 0]
				255,
				1,
				0,
				opIF,
				opIF,
				opPUSHB001, // not executed
				0x58,
				0x58,
				opELSE,
				opPUSHW000, // not executed
				0x58,
				0x58,
				opEIF,
				opELSE,
				opIF,
				opNPUSHB, // [255, 0x58, 0x58, 0x58]
				3,
				0x58,
				0x58,
				0x58,
				opELSE,
				opNPUSHW, // not executed
				2,
				0x58,
				0x58,
				0x58,
				0x58,
				opEIF,
				opEIF,
				opPUSHB000, // [255, 0x58, 0x58, 0x58, 254]
				254,
			},
			[]int32{255, 0x58, 0x58, 0x58, 254},
			"",
		},
		{
			"logical ops",
			[]byte{
				opPUSHB010, // [0, 10, 20]
				0,
				10,
				20,
				opAND, // [0, 1]
				opOR,  // [1]
				opNOT, // [0]
			},
			[]int32{0},
			"",
		},
		{
			"arithmetic ops",
			// Calculate abs((-(1 - (2*3)))/2 + 1/64).
			// The answer is 5/2 + 1/64 in ideal numbers, or 161 in 26.6 fixed point math.
			[]byte{
				opPUSHB010, // [64, 128, 192]
				1 << 6,
				2 << 6,
				3 << 6,
				opMUL,      // [64, 384]
				opSUB,      // [-320]
				opNEG,      // [320]
				opPUSHB000, // [320, 128]
				2 << 6,
				opDIV,      // [160]
				opPUSHB000, // [160, 1]
				1,
				opADD, // [161]
				opABS, // [161]
			},
			[]int32{161},
			"",
		},
		{
			"floor, ceiling",
			[]byte{
				opPUSHB000, // [96]
				96,
				opFLOOR,    // [64]
				opPUSHB000, // [64, 96]
				96,
				opCEILING, // [64, 128]
			},
			[]int32{64, 128},
			"",
		},
		{
			"rounding",
			// Round 1.40625 (which is 90/64) under various rounding policies.
			// See figure 20 of https://developer.apple.com/fonts/TTRefMan/RM02/Chap2.html#rounding
			[]byte{
				opROFF,     // []
				opPUSHB000, // [90]
				90,
				opROUND00,  // [90]
				opRTG,      // [90]
				opPUSHB000, // [90, 90]
				90,
				opROUND00,  // [90, 64]
				opRTHG,     // [90, 64]
				opPUSHB000, // [90, 64, 90]
				90,
				opROUND00,  // [90, 64, 96]
				opRDTG,     // [90, 64, 96]
				opPUSHB000, // [90, 64, 96, 90]
				90,
				opROUND00,  // [90, 64, 96, 64]
				opRUTG,     // [90, 64, 96, 64]
				opPUSHB000, // [90, 64, 96, 64, 90]
				90,
				opROUND00,  // [90, 64, 96, 64, 128]
				opRTDG,     // [90, 64, 96, 64, 128]
				opPUSHB000, // [90, 64, 96, 64, 128, 90]
				90,
				opROUND00, // [90, 64, 96, 64, 128, 96]
			},
			[]int32{90, 64, 96, 64, 128, 96},
			"",
		},
		{
			"super-rounding",
			// See figure 20 of https://developer.apple.com/fonts/TTRefMan/RM02/Chap2.html#rounding
			// and the sign preservation steps of the "Order of rounding operations" section.
			[]byte{
				opPUSHB000, // [0x58]
				0x58,
				opSROUND,   // []
				opPUSHW000, // [-81]
				0xff,
				0xaf,
				opROUND00,  // [-80]
				opPUSHW000, // [-80, -80]
				0xff,
				0xb0,
				opROUND00,  // [-80, -80]
				opPUSHW000, // [-80, -80, -17]
				0xff,
				0xef,
				opROUND00,  // [-80, -80, -16]
				opPUSHW000, // [-80, -80, -16, -16]
				0xff,
				0xf0,
				opROUND00,  // [-80, -80, -16, -16]
				opPUSHB000, // [-80, -80, -16, -16, 0]
				0,
				opROUND00,  // [-80, -80, -16, -16, 16]
				opPUSHB000, // [-80, -80, -16, -16, 16, 16]
				16,
				opROUND00,  // [-80, -80, -16, -16, 16, 16]
				opPUSHB000, // [-80, -80, -16, -16, 16, 16, 47]
				47,
				opROUND00,  // [-80, -80, -16, -16, 16, 16, 16]
				opPUSHB000, // [-80, -80, -16, -16, 16, 16, 16, 48]
				48,
				opROUND00, // [-80, -80, -16, -16, 16, 16, 16, 80]
			},
			[]int32{-80, -80, -16, -16, 16, 16, 16, 80},
			"",
		},
		{
			"roll",
			[]byte{
				opPUSHB010, // [1, 2, 3]
				1,
				2,
				3,
				opROLL, // [2, 3, 1]
			},
			[]int32{2, 3, 1},
			"",
		},
		{
			"max/min",
			[]byte{
				opPUSHW001, // [-2, -3]
				0xff,
				0xfe,
				0xff,
				0xfd,
				opMAX,      // [-2]
				opPUSHW001, // [-2, -4, -5]
				0xff,
				0xfc,
				0xff,
				0xfb,
				opMIN, // [-2, -5]
			},
			[]int32{-2, -5},
			"",
		},
		{
			"functions",
			[]byte{
				opPUSHB011, // [3, 7, 0, 3]
				3,
				7,
				0,
				3,

				opFDEF, // Function #3 (not called)
				opPUSHB000,
				98,
				opENDF,

				opFDEF, // Function #0
				opDUP,
				opADD,
				opENDF,

				opFDEF, // Function #7
				opPUSHB001,
				10,
				0,
				opCALL,
				opDUP,
				opENDF,

				opFDEF, // Function #3 (again)
				opPUSHB000,
				99,
				opENDF,

				opPUSHB001, // [2, 0]
				2,
				0,
				opCALL,     // [4]
				opPUSHB000, // [4, 3]
				3,
				opLOOPCALL, // [99, 99, 99, 99]
				opPUSHB000, // [99, 99, 99, 99, 7]
				7,
				opCALL, // [99, 99, 99, 99, 20, 20]
			},
			[]int32{99, 99, 99, 99, 20, 20},
			"",
		},
	}

	for _, tc := range testCases {
		h := &hinter{}
		h.init(&Font{
			maxStorage:       32,
			maxStackElements: 100,
		}, 768)
		err, errStr := h.run(tc.prog, nil, nil, nil, nil), ""
		if err != nil {
			errStr = err.Error()
		}
		if tc.errStr != "" {
			if errStr == "" {
				t.Errorf("%s: got no error, want %q", tc.desc, tc.errStr)
			} else if !strings.Contains(errStr, tc.errStr) {
				t.Errorf("%s: got error %q, want one containing %q", tc.desc, errStr, tc.errStr)
			}
			continue
		}
		if errStr != "" {
			t.Errorf("%s: got error %q, want none", tc.desc, errStr)
			continue
		}
		got := h.stack[:len(tc.want)]
		if !reflect.DeepEqual(got, tc.want) {
			t.Errorf("%s: got %v, want %v", tc.desc, got, tc.want)
			continue
		}
	}
}

// TestMove tests that the hinter.move method matches the output of the C
// Freetype implementation.
func TestMove(t *testing.T) {
	h, p := hinter{}, Point{}
	testCases := []struct {
		pvX, pvY, fvX, fvY f2dot14
		wantX, wantY       int32
	}{
		{+0x4000, +0x0000, +0x4000, +0x0000, +1000, +0},
		{+0x4000, +0x0000, -0x4000, +0x0000, +1000, +0},
		{-0x4000, +0x0000, +0x4000, +0x0000, -1000, +0},
		{-0x4000, +0x0000, -0x4000, +0x0000, -1000, +0},
		{+0x0000, +0x4000, +0x0000, +0x4000, +0, +1000},
		{+0x0000, +0x4000, +0x0000, -0x4000, +0, +1000},
		{+0x4000, +0x0000, +0x2d41, +0x2d41, +1000, +1000},
		{+0x4000, +0x0000, -0x2d41, +0x2d41, +1000, -1000},
		{+0x4000, +0x0000, +0x2d41, -0x2d41, +1000, -1000},
		{+0x4000, +0x0000, -0x2d41, -0x2d41, +1000, +1000},
		{-0x4000, +0x0000, +0x2d41, +0x2d41, -1000, -1000},
		{-0x4000, +0x0000, -0x2d41, +0x2d41, -1000, +1000},
		{-0x4000, +0x0000, +0x2d41, -0x2d41, -1000, +1000},
		{-0x4000, +0x0000, -0x2d41, -0x2d41, -1000, -1000},
		{+0x376d, +0x2000, +0x2d41, +0x2d41, +732, +732},
		{-0x376d, +0x2000, +0x2d41, +0x2d41, -2732, -2732},
		{+0x376d, +0x2000, +0x2d41, -0x2d41, +2732, -2732},
		{-0x376d, +0x2000, +0x2d41, -0x2d41, -732, +732},
		{-0x376d, -0x2000, +0x2d41, +0x2d41, -732, -732},
		{+0x376d, +0x2000, +0x4000, +0x0000, +1155, +0},
		{+0x376d, +0x2000, +0x0000, +0x4000, +0, +2000},
	}
	for _, tc := range testCases {
		p = Point{}
		h.gs.pv = [2]f2dot14{tc.pvX, tc.pvY}
		h.gs.fv = [2]f2dot14{tc.fvX, tc.fvY}
		h.move(&p, 1000, true)
		tx := p.Flags&flagTouchedX != 0
		ty := p.Flags&flagTouchedY != 0
		wantTX := tc.fvX != 0
		wantTY := tc.fvY != 0
		if p.X != tc.wantX || p.Y != tc.wantY || tx != wantTX || ty != wantTY {
			t.Errorf("pv=%v, fv=%v\ngot  %d, %d, %t, %t\nwant %d, %d, %t, %t",
				h.gs.pv, h.gs.fv, p.X, p.Y, tx, ty, tc.wantX, tc.wantY, wantTX, wantTY)
			continue
		}

		// Check that p is aligned with the freedom vector.
		a := int64(p.X) * int64(tc.fvY)
		b := int64(p.Y) * int64(tc.fvX)
		if a != b {
			t.Errorf("pv=%v, fv=%v, p=%v not aligned with fv", h.gs.pv, h.gs.fv, p)
			continue
		}

		// Check that the projected p is 1000 away from the origin.
		dotProd := (int64(p.X)*int64(tc.pvX) + int64(p.Y)*int64(tc.pvY) + 1<<13) >> 14
		if dotProd != 1000 {
			t.Errorf("pv=%v, fv=%v, p=%v not 1000 from origin", h.gs.pv, h.gs.fv, p)
			continue
		}
	}
}

// TestNormalize tests that the normalize function matches the output of the C
// Freetype implementation.
func TestNormalize(t *testing.T) {
	testCases := [][2]f2dot14{
		{-15895, 3974},
		{-15543, 5181},
		{-14654, 7327},
		{-11585, 11585},
		{0, 16384},
		{11585, 11585},
		{14654, 7327},
		{15543, 5181},
		{15895, 3974},
		{16066, 3213},
		{16161, 2694},
		{16219, 2317},
		{16257, 2032},
		{16284, 1809},
	}
	for i, want := range testCases {
		got := normalize(f2dot14(i)-4, 1)
		if got != want {
			t.Errorf("i=%d: got %v, want %v", i, got, want)
		}
	}
}
