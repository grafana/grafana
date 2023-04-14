package provisioning

import "fmt"

var ErrValidation = fmt.Errorf("invalid object specification")
var ErrNotFound = fmt.Errorf("object not found")
