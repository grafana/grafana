package waiter

import (
	"fmt"
	"reflect"
	"time"

	"github.com/aws/aws-sdk-go/aws/awserr"
	"github.com/aws/aws-sdk-go/aws/awsutil"
	"github.com/aws/aws-sdk-go/aws/request"
)

// A Config provides a collection of configuration values to setup a generated
// waiter code with.
type Config struct {
	Name        string
	Delay       int
	MaxAttempts int
	Operation   string
	Acceptors   []WaitAcceptor
}

// A WaitAcceptor provides the information needed to wait for an API operation
// to complete.
type WaitAcceptor struct {
	Expected interface{}
	Matcher  string
	State    string
	Argument string
}

// A Waiter provides waiting for an operation to complete.
type Waiter struct {
	Config
	Client interface{}
	Input  interface{}
}

// Wait waits for an operation to complete, expire max attempts, or fail. Error
// is returned if the operation fails.
func (w *Waiter) Wait() error {
	client := reflect.ValueOf(w.Client)
	in := reflect.ValueOf(w.Input)
	method := client.MethodByName(w.Config.Operation + "Request")

	for i := 0; i < w.MaxAttempts; i++ {
		res := method.Call([]reflect.Value{in})
		req := res[0].Interface().(*request.Request)
		req.Handlers.Build.PushBack(request.MakeAddToUserAgentFreeFormHandler("Waiter"))
		if err := req.Send(); err != nil {
			return err
		}

		for _, a := range w.Acceptors {
			result := false
			switch a.Matcher {
			case "pathAll":
				if vals, _ := awsutil.ValuesAtPath(req.Data, a.Argument); req.Error == nil && vals != nil {
					result = true
					for _, val := range vals {
						if !awsutil.DeepEqual(val, a.Expected) {
							result = false
							break
						}
					}
				}
			case "pathAny":
				if vals, _ := awsutil.ValuesAtPath(req.Data, a.Argument); req.Error == nil && vals != nil {
					for _, val := range vals {
						if awsutil.DeepEqual(val, a.Expected) {
							result = true
							break
						}
					}
				}
			case "status":
				s := a.Expected.(int)
				result = s == req.HTTPResponse.StatusCode
			}

			if result {
				switch a.State {
				case "success":
					return nil // waiter completed
				case "failure":
					if req.Error == nil {
						return awserr.New("ResourceNotReady",
							fmt.Sprintf("failed waiting for successful resource state"), nil)
					}
					return req.Error // waiter failed
				case "retry":
					// do nothing, just retry
				}
				break
			}
		}

		time.Sleep(time.Second * time.Duration(w.Delay))
	}

	return awserr.New("ResourceNotReady",
		fmt.Sprintf("exceeded %d wait attempts", w.MaxAttempts), nil)
}
