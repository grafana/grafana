package metadata

import (
	"fmt"
	"strings"

	"bosun.org/_third_party/github.com/StackExchange/wmi"
	"bosun.org/opentsdb"
	"bosun.org/slog"
)

func init() {
	metafuncs = append(metafuncs, metaWindowsVersion, metaWindowsIfaces)
}

func metaWindowsVersion() {
	var dst []Win32_OperatingSystem
	q := wmi.CreateQuery(&dst, "")
	err := wmi.Query(q, &dst)
	if err != nil {
		slog.Error(err)
		return
	}

	var dstComputer []Win32_ComputerSystem
	q = wmi.CreateQuery(&dstComputer, "")
	err = wmi.Query(q, &dstComputer)
	if err != nil {
		slog.Error(err)
		return
	}

	var dstBIOS []Win32_BIOS
	q = wmi.CreateQuery(&dstBIOS, "")
	err = wmi.Query(q, &dstBIOS)
	if err != nil {
		slog.Error(err)
		return
	}

	for _, v := range dst {
		AddMeta("", nil, "version", v.Version, true)
		AddMeta("", nil, "versionCaption", v.Caption, true)
	}

	for _, v := range dstComputer {
		AddMeta("", nil, "manufacturer", v.Manufacturer, true)
		AddMeta("", nil, "model", v.Model, true)
		AddMeta("", nil, "memoryTotal", v.TotalPhysicalMemory, true)
	}

	for _, v := range dstBIOS {
		AddMeta("", nil, "serialNumber", v.SerialNumber, true)
	}
}

type Win32_OperatingSystem struct {
	Caption string
	Version string
}

type Win32_ComputerSystem struct {
	Manufacturer        string
	Model               string
	TotalPhysicalMemory uint64
}

type Win32_BIOS struct {
	SerialNumber string
}

func metaWindowsIfaces() {
	var dstConfigs []Win32_NetworkAdapterConfiguration
	q := wmi.CreateQuery(&dstConfigs, "WHERE MACAddress != null")
	err := wmi.Query(q, &dstConfigs)
	if err != nil {
		slog.Error(err)
		return
	}

	mNicConfigs := make(map[uint32]*Win32_NetworkAdapterConfiguration)
	for i, nic := range dstConfigs {
		mNicConfigs[nic.InterfaceIndex] = &dstConfigs[i]
	}

	mNicTeamIDtoSpeed := make(map[string]uint64)
	mNicTeamIDtoMaster := make(map[string]string)
	var dstTeamMembers []MSFT_NetLbfoTeamMember
	q = wmi.CreateQuery(&dstTeamMembers, "")
	err = wmi.QueryNamespace(q, &dstTeamMembers, "root\\StandardCimv2")
	if err == nil {
		for _, teamMember := range dstTeamMembers {
			mNicTeamIDtoSpeed[teamMember.InstanceID] = teamMember.ReceiveLinkSpeed
			mNicTeamIDtoMaster[teamMember.InstanceID] = teamMember.Team
		}
	}

	var dstAdapters []Win32_NetworkAdapter
	q = wmi.CreateQuery(&dstAdapters, "WHERE PhysicalAdapter=True and MACAddress <> null and NetConnectionStatus = 2") //Only adapters with MAC addresses and status="Connected"
	err = wmi.Query(q, &dstAdapters)
	if err != nil {
		slog.Error(err)
		return
	}

	for _, v := range dstAdapters {
		tag := opentsdb.TagSet{"iface": fmt.Sprint("Interface", v.InterfaceIndex)}
		AddMeta("", tag, "description", v.Description, true)
		AddMeta("", tag, "name", v.NetConnectionID, true)
		AddMeta("", tag, "mac", strings.Replace(v.MACAddress, ":", "", -1), true)
		if v.Speed != nil && *v.Speed != 0 {
			AddMeta("", tag, "speed", v.Speed, true)
		} else {
			nicSpeed := mNicTeamIDtoSpeed[v.GUID]
			AddMeta("", tag, "speed", nicSpeed, true)
		}

		nicMaster := mNicTeamIDtoMaster[v.GUID]
		if nicMaster != "" {
			AddMeta("", tag, "master", nicMaster, true)
		}

		nicConfig := mNicConfigs[v.InterfaceIndex]
		if nicConfig != nil {
			for _, ip := range *nicConfig.IPAddress {
				AddMeta("", tag, "addr", ip, true) // blocked by array support in WMI See https://github.com/StackExchange/wmi/issues/5
			}
		}
	}
}

type Win32_NetworkAdapter struct {
	NetConnectionID string  //NY-WEB09-PRI-NIC-A
	Speed           *uint64 //Bits per Second
	Description     string  //Intel(R) Gigabit ET Quad Port Server Adapter #2
	InterfaceIndex  uint32
	MACAddress      string //00:1B:21:93:00:00
	GUID            string
}

type Win32_NetworkAdapterConfiguration struct {
	IPAddress      *[]string //Both IPv4 and IPv6
	InterfaceIndex uint32
}
type MSFT_NetLbfoTeamMember struct {
	Name             string
	ReceiveLinkSpeed uint64
	Team             string
	InstanceID       string
}
