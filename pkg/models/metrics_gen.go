package models

// NOTE: THIS FILE WAS PRODUCED BY THE
// MSGP CODE GENERATION TOOL (github.com/tinylib/msgp)
// DO NOT EDIT

import (
	"github.com/tinylib/msgp/msgp"
)

// DecodeMsg implements msgp.Decodable
func (z *MetricsArray) DecodeMsg(dc *msgp.Reader) (err error) {
	var xsz uint32
	xsz, err = dc.ReadArrayHeader()
	if err != nil {
		return
	}
	if cap((*z)) >= int(xsz) {
		(*z) = (*z)[:xsz]
	} else {
		(*z) = make(MetricsArray, xsz)
	}
	for bzg := range *z {
		if dc.IsNil() {
			err = dc.ReadNil()
			if err != nil {
				return
			}
			(*z)[bzg] = nil
		} else {
			if (*z)[bzg] == nil {
				(*z)[bzg] = new(MetricDefinition)
			}
			err = (*z)[bzg].DecodeMsg(dc)
			if err != nil {
				return
			}
		}
	}
	return
}

// EncodeMsg implements msgp.Encodable
func (z MetricsArray) EncodeMsg(en *msgp.Writer) (err error) {
	err = en.WriteArrayHeader(uint32(len(z)))
	if err != nil {
		return
	}
	for bai := range z {
		if z[bai] == nil {
			err = en.WriteNil()
			if err != nil {
				return
			}
		} else {
			err = z[bai].EncodeMsg(en)
			if err != nil {
				return
			}
		}
	}
	return
}

// MarshalMsg implements msgp.Marshaler
func (z MetricsArray) MarshalMsg(b []byte) (o []byte, err error) {
	o = msgp.Require(b, z.Msgsize())
	o = msgp.AppendArrayHeader(o, uint32(len(z)))
	for bai := range z {
		if z[bai] == nil {
			o = msgp.AppendNil(o)
		} else {
			o, err = z[bai].MarshalMsg(o)
			if err != nil {
				return
			}
		}
	}
	return
}

// UnmarshalMsg implements msgp.Unmarshaler
func (z *MetricsArray) UnmarshalMsg(bts []byte) (o []byte, err error) {
	var xsz uint32
	xsz, bts, err = msgp.ReadArrayHeaderBytes(bts)
	if err != nil {
		return
	}
	if cap((*z)) >= int(xsz) {
		(*z) = (*z)[:xsz]
	} else {
		(*z) = make(MetricsArray, xsz)
	}
	for cmr := range *z {
		if msgp.IsNil(bts) {
			bts, err = msgp.ReadNilBytes(bts)
			if err != nil {
				return
			}
			(*z)[cmr] = nil
		} else {
			if (*z)[cmr] == nil {
				(*z)[cmr] = new(MetricDefinition)
			}
			bts, err = (*z)[cmr].UnmarshalMsg(bts)
			if err != nil {
				return
			}
		}
	}
	o = bts
	return
}

func (z MetricsArray) Msgsize() (s int) {
	s = msgp.ArrayHeaderSize
	for ajw := range z {
		if z[ajw] == nil {
			s += msgp.NilSize
		} else {
			s += z[ajw].Msgsize()
		}
	}
	return
}
