package schema

// NOTE: THIS FILE WAS PRODUCED BY THE
// MSGP CODE GENERATION TOOL (github.com/tinylib/msgp)
// DO NOT EDIT

import (
	"github.com/tinylib/msgp/msgp"
)

// DecodeMsg implements msgp.Decodable
func (z *MetricData) DecodeMsg(dc *msgp.Reader) (err error) {
	var field []byte
	_ = field
	var isz uint32
	isz, err = dc.ReadMapHeader()
	if err != nil {
		return
	}
	for isz > 0 {
		isz--
		field, err = dc.ReadMapKeyPtr()
		if err != nil {
			return
		}
		switch msgp.UnsafeString(field) {
		case "OrgId":
			z.OrgId, err = dc.ReadInt()
			if err != nil {
				return
			}
		case "Name":
			z.Name, err = dc.ReadString()
			if err != nil {
				return
			}
		case "Metric":
			z.Metric, err = dc.ReadString()
			if err != nil {
				return
			}
		case "Interval":
			z.Interval, err = dc.ReadInt()
			if err != nil {
				return
			}
		case "Value":
			z.Value, err = dc.ReadFloat64()
			if err != nil {
				return
			}
		case "Unit":
			z.Unit, err = dc.ReadString()
			if err != nil {
				return
			}
		case "Time":
			z.Time, err = dc.ReadInt64()
			if err != nil {
				return
			}
		case "TargetType":
			z.TargetType, err = dc.ReadString()
			if err != nil {
				return
			}
		case "Tags":
			var msz uint32
			msz, err = dc.ReadMapHeader()
			if err != nil {
				return
			}
			if z.Tags == nil && msz > 0 {
				z.Tags = make(map[string]string, msz)
			} else if len(z.Tags) > 0 {
				for key, _ := range z.Tags {
					delete(z.Tags, key)
				}
			}
			for msz > 0 {
				msz--
				var xvk string
				var bzg string
				xvk, err = dc.ReadString()
				if err != nil {
					return
				}
				bzg, err = dc.ReadString()
				if err != nil {
					return
				}
				z.Tags[xvk] = bzg
			}
		default:
			err = dc.Skip()
			if err != nil {
				return
			}
		}
	}
	return
}

// EncodeMsg implements msgp.Encodable
func (z *MetricData) EncodeMsg(en *msgp.Writer) (err error) {
	// map header, size 9
	// write "OrgId"
	err = en.Append(0x89, 0xa5, 0x4f, 0x72, 0x67, 0x49, 0x64)
	if err != nil {
		return err
	}
	err = en.WriteInt(z.OrgId)
	if err != nil {
		return
	}
	// write "Name"
	err = en.Append(0xa4, 0x4e, 0x61, 0x6d, 0x65)
	if err != nil {
		return err
	}
	err = en.WriteString(z.Name)
	if err != nil {
		return
	}
	// write "Metric"
	err = en.Append(0xa6, 0x4d, 0x65, 0x74, 0x72, 0x69, 0x63)
	if err != nil {
		return err
	}
	err = en.WriteString(z.Metric)
	if err != nil {
		return
	}
	// write "Interval"
	err = en.Append(0xa8, 0x49, 0x6e, 0x74, 0x65, 0x72, 0x76, 0x61, 0x6c)
	if err != nil {
		return err
	}
	err = en.WriteInt(z.Interval)
	if err != nil {
		return
	}
	// write "Value"
	err = en.Append(0xa5, 0x56, 0x61, 0x6c, 0x75, 0x65)
	if err != nil {
		return err
	}
	err = en.WriteFloat64(z.Value)
	if err != nil {
		return
	}
	// write "Unit"
	err = en.Append(0xa4, 0x55, 0x6e, 0x69, 0x74)
	if err != nil {
		return err
	}
	err = en.WriteString(z.Unit)
	if err != nil {
		return
	}
	// write "Time"
	err = en.Append(0xa4, 0x54, 0x69, 0x6d, 0x65)
	if err != nil {
		return err
	}
	err = en.WriteInt64(z.Time)
	if err != nil {
		return
	}
	// write "TargetType"
	err = en.Append(0xaa, 0x54, 0x61, 0x72, 0x67, 0x65, 0x74, 0x54, 0x79, 0x70, 0x65)
	if err != nil {
		return err
	}
	err = en.WriteString(z.TargetType)
	if err != nil {
		return
	}
	// write "Tags"
	err = en.Append(0xa4, 0x54, 0x61, 0x67, 0x73)
	if err != nil {
		return err
	}
	err = en.WriteMapHeader(uint32(len(z.Tags)))
	if err != nil {
		return
	}
	for xvk, bzg := range z.Tags {
		err = en.WriteString(xvk)
		if err != nil {
			return
		}
		err = en.WriteString(bzg)
		if err != nil {
			return
		}
	}
	return
}

// MarshalMsg implements msgp.Marshaler
func (z *MetricData) MarshalMsg(b []byte) (o []byte, err error) {
	o = msgp.Require(b, z.Msgsize())
	// map header, size 9
	// string "OrgId"
	o = append(o, 0x89, 0xa5, 0x4f, 0x72, 0x67, 0x49, 0x64)
	o = msgp.AppendInt(o, z.OrgId)
	// string "Name"
	o = append(o, 0xa4, 0x4e, 0x61, 0x6d, 0x65)
	o = msgp.AppendString(o, z.Name)
	// string "Metric"
	o = append(o, 0xa6, 0x4d, 0x65, 0x74, 0x72, 0x69, 0x63)
	o = msgp.AppendString(o, z.Metric)
	// string "Interval"
	o = append(o, 0xa8, 0x49, 0x6e, 0x74, 0x65, 0x72, 0x76, 0x61, 0x6c)
	o = msgp.AppendInt(o, z.Interval)
	// string "Value"
	o = append(o, 0xa5, 0x56, 0x61, 0x6c, 0x75, 0x65)
	o = msgp.AppendFloat64(o, z.Value)
	// string "Unit"
	o = append(o, 0xa4, 0x55, 0x6e, 0x69, 0x74)
	o = msgp.AppendString(o, z.Unit)
	// string "Time"
	o = append(o, 0xa4, 0x54, 0x69, 0x6d, 0x65)
	o = msgp.AppendInt64(o, z.Time)
	// string "TargetType"
	o = append(o, 0xaa, 0x54, 0x61, 0x72, 0x67, 0x65, 0x74, 0x54, 0x79, 0x70, 0x65)
	o = msgp.AppendString(o, z.TargetType)
	// string "Tags"
	o = append(o, 0xa4, 0x54, 0x61, 0x67, 0x73)
	o = msgp.AppendMapHeader(o, uint32(len(z.Tags)))
	for xvk, bzg := range z.Tags {
		o = msgp.AppendString(o, xvk)
		o = msgp.AppendString(o, bzg)
	}
	return
}

// UnmarshalMsg implements msgp.Unmarshaler
func (z *MetricData) UnmarshalMsg(bts []byte) (o []byte, err error) {
	var field []byte
	_ = field
	var isz uint32
	isz, bts, err = msgp.ReadMapHeaderBytes(bts)
	if err != nil {
		return
	}
	for isz > 0 {
		isz--
		field, bts, err = msgp.ReadMapKeyZC(bts)
		if err != nil {
			return
		}
		switch msgp.UnsafeString(field) {
		case "OrgId":
			z.OrgId, bts, err = msgp.ReadIntBytes(bts)
			if err != nil {
				return
			}
		case "Name":
			z.Name, bts, err = msgp.ReadStringBytes(bts)
			if err != nil {
				return
			}
		case "Metric":
			z.Metric, bts, err = msgp.ReadStringBytes(bts)
			if err != nil {
				return
			}
		case "Interval":
			z.Interval, bts, err = msgp.ReadIntBytes(bts)
			if err != nil {
				return
			}
		case "Value":
			z.Value, bts, err = msgp.ReadFloat64Bytes(bts)
			if err != nil {
				return
			}
		case "Unit":
			z.Unit, bts, err = msgp.ReadStringBytes(bts)
			if err != nil {
				return
			}
		case "Time":
			z.Time, bts, err = msgp.ReadInt64Bytes(bts)
			if err != nil {
				return
			}
		case "TargetType":
			z.TargetType, bts, err = msgp.ReadStringBytes(bts)
			if err != nil {
				return
			}
		case "Tags":
			var msz uint32
			msz, bts, err = msgp.ReadMapHeaderBytes(bts)
			if err != nil {
				return
			}
			if z.Tags == nil && msz > 0 {
				z.Tags = make(map[string]string, msz)
			} else if len(z.Tags) > 0 {
				for key, _ := range z.Tags {
					delete(z.Tags, key)
				}
			}
			for msz > 0 {
				var xvk string
				var bzg string
				msz--
				xvk, bts, err = msgp.ReadStringBytes(bts)
				if err != nil {
					return
				}
				bzg, bts, err = msgp.ReadStringBytes(bts)
				if err != nil {
					return
				}
				z.Tags[xvk] = bzg
			}
		default:
			bts, err = msgp.Skip(bts)
			if err != nil {
				return
			}
		}
	}
	o = bts
	return
}

func (z *MetricData) Msgsize() (s int) {
	s = 1 + 6 + msgp.IntSize + 5 + msgp.StringPrefixSize + len(z.Name) + 7 + msgp.StringPrefixSize + len(z.Metric) + 9 + msgp.IntSize + 6 + msgp.Float64Size + 5 + msgp.StringPrefixSize + len(z.Unit) + 5 + msgp.Int64Size + 11 + msgp.StringPrefixSize + len(z.TargetType) + 5 + msgp.MapHeaderSize
	if z.Tags != nil {
		for xvk, bzg := range z.Tags {
			_ = bzg
			s += msgp.StringPrefixSize + len(xvk) + msgp.StringPrefixSize + len(bzg)
		}
	}
	return
}

// DecodeMsg implements msgp.Decodable
func (z *MetricDataArray) DecodeMsg(dc *msgp.Reader) (err error) {
	var xsz uint32
	xsz, err = dc.ReadArrayHeader()
	if err != nil {
		return
	}
	if cap((*z)) >= int(xsz) {
		(*z) = (*z)[:xsz]
	} else {
		(*z) = make(MetricDataArray, xsz)
	}
	for cmr := range *z {
		if dc.IsNil() {
			err = dc.ReadNil()
			if err != nil {
				return
			}
			(*z)[cmr] = nil
		} else {
			if (*z)[cmr] == nil {
				(*z)[cmr] = new(MetricData)
			}
			err = (*z)[cmr].DecodeMsg(dc)
			if err != nil {
				return
			}
		}
	}
	return
}

// EncodeMsg implements msgp.Encodable
func (z MetricDataArray) EncodeMsg(en *msgp.Writer) (err error) {
	err = en.WriteArrayHeader(uint32(len(z)))
	if err != nil {
		return
	}
	for ajw := range z {
		if z[ajw] == nil {
			err = en.WriteNil()
			if err != nil {
				return
			}
		} else {
			err = z[ajw].EncodeMsg(en)
			if err != nil {
				return
			}
		}
	}
	return
}

// MarshalMsg implements msgp.Marshaler
func (z MetricDataArray) MarshalMsg(b []byte) (o []byte, err error) {
	o = msgp.Require(b, z.Msgsize())
	o = msgp.AppendArrayHeader(o, uint32(len(z)))
	for ajw := range z {
		if z[ajw] == nil {
			o = msgp.AppendNil(o)
		} else {
			o, err = z[ajw].MarshalMsg(o)
			if err != nil {
				return
			}
		}
	}
	return
}

// UnmarshalMsg implements msgp.Unmarshaler
func (z *MetricDataArray) UnmarshalMsg(bts []byte) (o []byte, err error) {
	var xsz uint32
	xsz, bts, err = msgp.ReadArrayHeaderBytes(bts)
	if err != nil {
		return
	}
	if cap((*z)) >= int(xsz) {
		(*z) = (*z)[:xsz]
	} else {
		(*z) = make(MetricDataArray, xsz)
	}
	for wht := range *z {
		if msgp.IsNil(bts) {
			bts, err = msgp.ReadNilBytes(bts)
			if err != nil {
				return
			}
			(*z)[wht] = nil
		} else {
			if (*z)[wht] == nil {
				(*z)[wht] = new(MetricData)
			}
			bts, err = (*z)[wht].UnmarshalMsg(bts)
			if err != nil {
				return
			}
		}
	}
	o = bts
	return
}

func (z MetricDataArray) Msgsize() (s int) {
	s = msgp.ArrayHeaderSize
	for hct := range z {
		if z[hct] == nil {
			s += msgp.NilSize
		} else {
			s += z[hct].Msgsize()
		}
	}
	return
}

// DecodeMsg implements msgp.Decodable
func (z *MetricDefinition) DecodeMsg(dc *msgp.Reader) (err error) {
	var field []byte
	_ = field
	var isz uint32
	isz, err = dc.ReadMapHeader()
	if err != nil {
		return
	}
	for isz > 0 {
		isz--
		field, err = dc.ReadMapKeyPtr()
		if err != nil {
			return
		}
		switch msgp.UnsafeString(field) {
		case "Id":
			z.Id, err = dc.ReadString()
			if err != nil {
				return
			}
		case "OrgId":
			z.OrgId, err = dc.ReadInt()
			if err != nil {
				return
			}
		case "Name":
			z.Name, err = dc.ReadString()
			if err != nil {
				return
			}
		case "Metric":
			z.Metric, err = dc.ReadString()
			if err != nil {
				return
			}
		case "Interval":
			z.Interval, err = dc.ReadInt()
			if err != nil {
				return
			}
		case "Unit":
			z.Unit, err = dc.ReadString()
			if err != nil {
				return
			}
		case "TargetType":
			z.TargetType, err = dc.ReadString()
			if err != nil {
				return
			}
		case "Tags":
			var msz uint32
			msz, err = dc.ReadMapHeader()
			if err != nil {
				return
			}
			if z.Tags == nil && msz > 0 {
				z.Tags = make(map[string]string, msz)
			} else if len(z.Tags) > 0 {
				for key, _ := range z.Tags {
					delete(z.Tags, key)
				}
			}
			for msz > 0 {
				msz--
				var cua string
				var xhx string
				cua, err = dc.ReadString()
				if err != nil {
					return
				}
				xhx, err = dc.ReadString()
				if err != nil {
					return
				}
				z.Tags[cua] = xhx
			}
		case "LastUpdate":
			z.LastUpdate, err = dc.ReadInt64()
			if err != nil {
				return
			}
		default:
			err = dc.Skip()
			if err != nil {
				return
			}
		}
	}
	return
}

// EncodeMsg implements msgp.Encodable
func (z *MetricDefinition) EncodeMsg(en *msgp.Writer) (err error) {
	// map header, size 9
	// write "Id"
	err = en.Append(0x89, 0xa2, 0x49, 0x64)
	if err != nil {
		return err
	}
	err = en.WriteString(z.Id)
	if err != nil {
		return
	}
	// write "OrgId"
	err = en.Append(0xa5, 0x4f, 0x72, 0x67, 0x49, 0x64)
	if err != nil {
		return err
	}
	err = en.WriteInt(z.OrgId)
	if err != nil {
		return
	}
	// write "Name"
	err = en.Append(0xa4, 0x4e, 0x61, 0x6d, 0x65)
	if err != nil {
		return err
	}
	err = en.WriteString(z.Name)
	if err != nil {
		return
	}
	// write "Metric"
	err = en.Append(0xa6, 0x4d, 0x65, 0x74, 0x72, 0x69, 0x63)
	if err != nil {
		return err
	}
	err = en.WriteString(z.Metric)
	if err != nil {
		return
	}
	// write "Interval"
	err = en.Append(0xa8, 0x49, 0x6e, 0x74, 0x65, 0x72, 0x76, 0x61, 0x6c)
	if err != nil {
		return err
	}
	err = en.WriteInt(z.Interval)
	if err != nil {
		return
	}
	// write "Unit"
	err = en.Append(0xa4, 0x55, 0x6e, 0x69, 0x74)
	if err != nil {
		return err
	}
	err = en.WriteString(z.Unit)
	if err != nil {
		return
	}
	// write "TargetType"
	err = en.Append(0xaa, 0x54, 0x61, 0x72, 0x67, 0x65, 0x74, 0x54, 0x79, 0x70, 0x65)
	if err != nil {
		return err
	}
	err = en.WriteString(z.TargetType)
	if err != nil {
		return
	}
	// write "Tags"
	err = en.Append(0xa4, 0x54, 0x61, 0x67, 0x73)
	if err != nil {
		return err
	}
	err = en.WriteMapHeader(uint32(len(z.Tags)))
	if err != nil {
		return
	}
	for cua, xhx := range z.Tags {
		err = en.WriteString(cua)
		if err != nil {
			return
		}
		err = en.WriteString(xhx)
		if err != nil {
			return
		}
	}
	// write "LastUpdate"
	err = en.Append(0xaa, 0x4c, 0x61, 0x73, 0x74, 0x55, 0x70, 0x64, 0x61, 0x74, 0x65)
	if err != nil {
		return err
	}
	err = en.WriteInt64(z.LastUpdate)
	if err != nil {
		return
	}
	return
}

// MarshalMsg implements msgp.Marshaler
func (z *MetricDefinition) MarshalMsg(b []byte) (o []byte, err error) {
	o = msgp.Require(b, z.Msgsize())
	// map header, size 9
	// string "Id"
	o = append(o, 0x89, 0xa2, 0x49, 0x64)
	o = msgp.AppendString(o, z.Id)
	// string "OrgId"
	o = append(o, 0xa5, 0x4f, 0x72, 0x67, 0x49, 0x64)
	o = msgp.AppendInt(o, z.OrgId)
	// string "Name"
	o = append(o, 0xa4, 0x4e, 0x61, 0x6d, 0x65)
	o = msgp.AppendString(o, z.Name)
	// string "Metric"
	o = append(o, 0xa6, 0x4d, 0x65, 0x74, 0x72, 0x69, 0x63)
	o = msgp.AppendString(o, z.Metric)
	// string "Interval"
	o = append(o, 0xa8, 0x49, 0x6e, 0x74, 0x65, 0x72, 0x76, 0x61, 0x6c)
	o = msgp.AppendInt(o, z.Interval)
	// string "Unit"
	o = append(o, 0xa4, 0x55, 0x6e, 0x69, 0x74)
	o = msgp.AppendString(o, z.Unit)
	// string "TargetType"
	o = append(o, 0xaa, 0x54, 0x61, 0x72, 0x67, 0x65, 0x74, 0x54, 0x79, 0x70, 0x65)
	o = msgp.AppendString(o, z.TargetType)
	// string "Tags"
	o = append(o, 0xa4, 0x54, 0x61, 0x67, 0x73)
	o = msgp.AppendMapHeader(o, uint32(len(z.Tags)))
	for cua, xhx := range z.Tags {
		o = msgp.AppendString(o, cua)
		o = msgp.AppendString(o, xhx)
	}
	// string "LastUpdate"
	o = append(o, 0xaa, 0x4c, 0x61, 0x73, 0x74, 0x55, 0x70, 0x64, 0x61, 0x74, 0x65)
	o = msgp.AppendInt64(o, z.LastUpdate)
	return
}

// UnmarshalMsg implements msgp.Unmarshaler
func (z *MetricDefinition) UnmarshalMsg(bts []byte) (o []byte, err error) {
	var field []byte
	_ = field
	var isz uint32
	isz, bts, err = msgp.ReadMapHeaderBytes(bts)
	if err != nil {
		return
	}
	for isz > 0 {
		isz--
		field, bts, err = msgp.ReadMapKeyZC(bts)
		if err != nil {
			return
		}
		switch msgp.UnsafeString(field) {
		case "Id":
			z.Id, bts, err = msgp.ReadStringBytes(bts)
			if err != nil {
				return
			}
		case "OrgId":
			z.OrgId, bts, err = msgp.ReadIntBytes(bts)
			if err != nil {
				return
			}
		case "Name":
			z.Name, bts, err = msgp.ReadStringBytes(bts)
			if err != nil {
				return
			}
		case "Metric":
			z.Metric, bts, err = msgp.ReadStringBytes(bts)
			if err != nil {
				return
			}
		case "Interval":
			z.Interval, bts, err = msgp.ReadIntBytes(bts)
			if err != nil {
				return
			}
		case "Unit":
			z.Unit, bts, err = msgp.ReadStringBytes(bts)
			if err != nil {
				return
			}
		case "TargetType":
			z.TargetType, bts, err = msgp.ReadStringBytes(bts)
			if err != nil {
				return
			}
		case "Tags":
			var msz uint32
			msz, bts, err = msgp.ReadMapHeaderBytes(bts)
			if err != nil {
				return
			}
			if z.Tags == nil && msz > 0 {
				z.Tags = make(map[string]string, msz)
			} else if len(z.Tags) > 0 {
				for key, _ := range z.Tags {
					delete(z.Tags, key)
				}
			}
			for msz > 0 {
				var cua string
				var xhx string
				msz--
				cua, bts, err = msgp.ReadStringBytes(bts)
				if err != nil {
					return
				}
				xhx, bts, err = msgp.ReadStringBytes(bts)
				if err != nil {
					return
				}
				z.Tags[cua] = xhx
			}
		case "LastUpdate":
			z.LastUpdate, bts, err = msgp.ReadInt64Bytes(bts)
			if err != nil {
				return
			}
		default:
			bts, err = msgp.Skip(bts)
			if err != nil {
				return
			}
		}
	}
	o = bts
	return
}

func (z *MetricDefinition) Msgsize() (s int) {
	s = 1 + 3 + msgp.StringPrefixSize + len(z.Id) + 6 + msgp.IntSize + 5 + msgp.StringPrefixSize + len(z.Name) + 7 + msgp.StringPrefixSize + len(z.Metric) + 9 + msgp.IntSize + 5 + msgp.StringPrefixSize + len(z.Unit) + 11 + msgp.StringPrefixSize + len(z.TargetType) + 5 + msgp.MapHeaderSize
	if z.Tags != nil {
		for cua, xhx := range z.Tags {
			_ = xhx
			s += msgp.StringPrefixSize + len(cua) + msgp.StringPrefixSize + len(xhx)
		}
	}
	s += 11 + msgp.Int64Size
	return
}
