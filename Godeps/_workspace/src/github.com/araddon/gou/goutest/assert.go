package goutest

import (
	"fmt"
	"testing"
)

// dumb simple assert for testing, printing
//    Assert(len(items) == 9, t, "Should be 9 but was %d", len(items))
func Assert(is bool, t *testing.T, args ...interface{}) {
	if is == false {
		msg := ""
		if len(args) > 1 {
			switch val := args[0].(type) {
			case string:
				msg = fmt.Sprintf(val, args[1:len(args)-1])
			default:
				msg = fmt.Sprint(args)
			}

		} else if len(args) == 1 {
			switch val := args[0].(type) {
			case string:
				msg = val
			default:
				msg = fmt.Sprint(val)
			}
		}

		//gou.DoLog(3, gou.ERROR, msg)
		t.Fatal(msg)
	}
}
