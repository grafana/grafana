// Copyright 2014 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// +build darwin freebsd linux

package ipv4

import (
	"net"
	"os"
	"unsafe"

	"bosun.org/_third_party/golang.org/x/net/internal/iana"
)

func setsockoptGroupReq(fd, name int, ifi *net.Interface, grp net.IP) error {
	var gr sysGroupReq
	if ifi != nil {
		gr.Interface = uint32(ifi.Index)
	}
	gr.setGroup(grp)
	return os.NewSyscallError("setsockopt", setsockopt(fd, iana.ProtocolIP, name, unsafe.Pointer(&gr), sysSizeofGroupReq))
}

func setsockoptGroupSourceReq(fd, name int, ifi *net.Interface, grp, src net.IP) error {
	var gsr sysGroupSourceReq
	if ifi != nil {
		gsr.Interface = uint32(ifi.Index)
	}
	gsr.setSourceGroup(grp, src)
	return os.NewSyscallError("setsockopt", setsockopt(fd, iana.ProtocolIP, name, unsafe.Pointer(&gsr), sysSizeofGroupSourceReq))
}
