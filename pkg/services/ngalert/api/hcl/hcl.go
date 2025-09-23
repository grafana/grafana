package hcl

import (
	"fmt"

	"github.com/hashicorp/hcl/v2/gohcl"
	"github.com/hashicorp/hcl/v2/hclwrite"
)

type Resource struct {
	Type string      `hcl:"type,label"`
	Name string      `hcl:"name,label"`
	Body interface{} `hcl:",block"`
}

func Encode(resources ...Resource) (data []byte, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("failed to encode struct to HCL: %v", r)
		}
	}()
	f := hclwrite.NewEmptyFile()

	for _, resource := range resources {
		blk := gohcl.EncodeAsBlock(resource.Body, "resource")
		blk.SetLabels([]string{resource.Type, resource.Name})
		f.Body().AppendBlock(blk)
	}
	return f.Bytes(), nil
}
