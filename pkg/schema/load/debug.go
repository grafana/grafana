package load

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"strings"

	"cuelang.org/go/cue"
)

var jf io.Writer = ioutil.Discard

func init() {
	// prepdump()
}

func prepdump() {
	var err error
	jf, err = os.OpenFile("dump.json", os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0755)

	if err != nil {
		panic(err)
	}
}

// Exercises all read-only funcs on a cue.Value.
//
// For great grokking, because the underlying datastructures are too complex to
// grasp directly.
func dumpJSON(name string, v cue.Value, showerrs bool) {
	whole := map[string]interface{}{
		name: assembleValues(v, showerrs, 0),
	}
	b, err := json.MarshalIndent(whole, "", "  ")
	if err != nil {
		panic(err)
	}

	fmt.Fprint(jf, string(b))
}

func assembleValues(v cue.Value, showerrs bool, depth int) (ret map[string]interface{}) {
	ret = make(map[string]interface{})
	r := func(iv cue.Value) map[string]interface{} {
		return assembleValues(iv, showerrs, depth+1)
	}

	if depth > 4 {
		ret["STOP"] = "RECURSION"
		return
	}

	// attr := v.Attribute(attrname)
	// if attr.Err() == nil {
	// 	val, found, err := attr.Lookup(0, "targetType")
	// 	if err == nil && found {
	// 		ret["Attr() targetType"] = val
	// 	}
	// }

	// dv := cue.Dereference(v)
	// if !dv.Equals(v) {
	// 	ret["Dereference()"] = r(dv)
	// } else {
	// 	ret["Dereference()"] = "no-op"
	// }

	ret["Source() type"] = fmt.Sprintf("%T", v.Source())

	if br, err := v.Bool(); err == nil {
		ret["Bool()"] = br
	} else if showerrs {
		ret["ERR Bool()"] = err
	}

	if by, err := v.Bytes(); err == nil {
		ret["Bytes()"] = string(by)
	} else if showerrs {
		ret["ERR Bytes()"] = err
	}

	// skip Decimal (internal only)

	if def, exists := v.Default(); exists {
		ret["Default()"] = r(def)
	}

	// Skipping docs for now because...annoying
	// if docs := v.Doc(); len(docs) > 0 {
	// 	fmt.Fprintf(b, "%sDoc():\n", )
	// 	for _, d := range docs {
	// 		fmt.Fprintf(b, "%s\n", d)
	// 	}
	// }

	if elem, exists := v.Elem(); exists {
		ret["Elem()"] = r(elem)
	}

	if err := v.Err(); err != nil {
		ret["Err()"] = err
	}

	if eval := v.Eval(); !v.Equals(eval) {
		ret["Eval() new val"] = r(eval)
	}

	// ret["Exists()"] = v.Exists()

	op, vals := v.Expr()
	if op != cue.NoOp {
		var exprvals []map[string]interface{}
		for _, val := range vals {
			if !v.Equals(val) {
				exprvals = append(exprvals, r(val))
			}
		}
		if len(exprvals) > 0 {
			ret["Expr()"] = map[string]interface{}{
				"Op":    op.String(),
				"Parts": exprvals,
			}
		}
	}

	// Skip Fields(), walking is up to the caller

	if v2, err := v.Float64(); err == nil {
		ret["Float64()"] = v2
	} else if showerrs {
		ret["ERR Float64()"] = err
	}

	ret["IncompleteKind()"] = fmt.Sprint(v.IncompleteKind())

	if v2, err := v.Int(nil); err == nil {
		ret["Int()"] = v2
	} else if showerrs {
		ret["ERR Int()"] = err
	}

	if v2, err := v.Int64(); err == nil {
		ret["Int64()"] = v2
	} else if showerrs {
		ret["ERR Int64()"] = err
	}

	ret["IsClosed()"] = v.IsClosed()
	ret["IsConcrete()"] = v.IsConcrete()
	ret["Kind()"] = fmt.Sprint(v.Kind())

	if label, exists := v.Label(); exists {
		ret["Label()"] = label
	}

	// Skipping Len. If the return is just a number, why is it a Value?

	if _, err := v.List(); err == nil {
		ret["List()"] = "returns iter"
	} else if showerrs {
		ret["ERR List()"] = err
	}

	if err := v.Null(); err == nil {
		ret["Null()"] = "yup it's null"
	} else if showerrs {
		ret["ERR Null()"] = err
	}

	ret["Path()"] = fmt.Sprint(v.Path())

	// Skip Pos()
	// Skip Reader()

	if v2, err := v.String(); err == nil {
		ret["String()"] = v2
	} else if showerrs {
		ret["ERR String()"] = err
	}

	if strc, err := v.Struct(); err == nil {
		sub := make(map[string]map[string]interface{})
		for i := 0; i < strc.Len(); i++ {
			sk, sv := strc.At(i)
			sub[sk] = r(sv)
		}
		ret["Struct() fields"] = sub
	} else if showerrs {
		ret["ERR Struct()"] = err
	}

	_, path := v.Reference()
	if len(path) > 0 {
		ret["Reference() path"] = strings.Join(path, ".")
	}

	// Skip Syntax()
	if v2, err := v.Uint64(); err == nil {
		ret["Uint64()"] = v2
	} else if showerrs {
		ret["ERR Uint64()"] = err
	}

	// Skip Validate()
	return
}
