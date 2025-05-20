package pipelines_test

// type TestCLIContext struct {
// 	Data map[string]interface{}
// }
//
// func (t *TestCLIContext) Bool(key string) bool {
// 	if _, ok := t.Data[key]; !ok {
// 		return false
// 	}
//
// 	return t.Data[key].(bool)
// }
//
// func (t *TestCLIContext) String(key string) string {
// 	if _, ok := t.Data[key]; !ok {
// 		return ""
// 	}
//
// 	return t.Data[key].(string)
// }
//
// func (t *TestCLIContext) Set(key string, val string) error {
// 	t.Data[key] = val
//
// 	return nil
// }
//
// func (t *TestCLIContext) StringSlice(key string) []string {
// 	if _, ok := t.Data[key]; !ok {
// 		return nil
// 	}
// 	return t.Data[key].([]string)
// }
//
// func (t *TestCLIContext) Path(key string) string {
// 	return t.Data[key].(string)
// }
//
// func (t *TestCLIContext) Int64(key string) int64 {
// 	if _, ok := t.Data[key]; !ok {
// 		return 0
// 	}
//
// 	return t.Data[key].(int64)
// }
//
// func TestPipelineArgsFromContext(t *testing.T) {
// 	enterpriseDir, err := os.MkdirTemp("", "grafana-enterprise-*")
// 	if err != nil {
// 		t.Fatal(err)
// 	}
//
// 	validData := map[string]interface{}{
// 		"v":              true,
// 		"version":        "v1.0.0",
// 		"grafana":        true,
// 		"grafana-dir":    "/grafana",
// 		"grafana-ref":    "asdf",
// 		"enterprise":     true,
// 		"enterprise-dir": enterpriseDir,
// 		"enterprise-ref": "1234",
// 		"build-id":       "build-1234",
// 		"github-token":   "",
// 		"sign":           false,
// 	}
//
// 	// t.Run("It should return a PipelineArgs object if there are no errors", func(t *testing.T) {
// 	// 	args, err := pipelines.PipelineArgsFromContext(context.Background(), &TestCLIContext{
// 	// 		Data: validData,
// 	// 	})
// 	// 	if err != nil {
// 	// 		t.Fatal(err)
// 	// 	}
//
// 	// 	if args.Verbose != true {
// 	// 		t.Error("args.Verbose should be true")
// 	// 	}
// 	// 	// opts := args.GrafanaOpts
// 	// 	// if opts.Version != "v1.0.0" {
// 	// 	// 	t.Error("args.Version should be v1.0.0")
// 	// 	// }
//
// 	// 	if opts.BuildGrafana != true {
// 	// 		t.Error("args.BuildGrafana should be true")
// 	// 	}
//
// 	// 	if opts.GrafanaDir != "/grafana" {
// 	// 		t.Error("args.GrafanaDir should be /grafana")
// 	// 	}
//
// 	// 	if opts.GrafanaRef != "asdf" {
// 	// 		t.Error("args.GrafanaRef should be asdf")
// 	// 	}
//
// 	// 	if opts.BuildEnterprise != true {
// 	// 		t.Error("args.Enterprise should be true")
// 	// 	}
//
// 	// 	if opts.EnterpriseDir != enterpriseDir {
// 	// 		t.Errorf("args.EnterpriseDir should be %s", enterpriseDir)
// 	// 	}
//
// 	// 	if opts.EnterpriseRef != "1234" {
// 	// 		t.Error("args.EnterpriseRef should be 1234")
// 	// 	}
// 	// })
//
// 	// t.Run("If no build ID is provided, a random 12-character string should be given", func(t *testing.T) {
// 	// 	data := validData
// 	// 	data["build-id"] = ""
// 	// 	args, err := pipelines.PipelineArgsFromContext(context.Background(), &TestCLIContext{
// 	// 		Data: data,
// 	// 	})
// 	// 	if err != nil {
// 	// 		t.Fatal(err)
// 	// 	}
// 	// 	opts := args.GrafanaOpts
// 	// 	if opts.BuildID == "" {
// 	// 		t.Fatal("BuildID should not be empty")
// 	// 	}
// 	// 	if len(opts.BuildID) != 12 {
// 	// 		t.Fatal("BuildID should be a 12-character string")
// 	// 	}
// 	// })
//
// 	// t.Run("If the --enterprise-ref is set to a non-default value, it should set the enterprise flag to true", func(t *testing.T) {
// 	// 	data := validData
// 	// 	data["enterprise"] = false
// 	// 	data["enterprise-ref"] = "ref-1234"
//
// 	// 	args, err := pipelines.PipelineArgsFromContext(context.Background(), &TestCLIContext{
// 	// 		Data: data,
// 	// 	})
// 	// 	if err != nil {
// 	// 		t.Fatal(err)
// 	// 	}
// 	// 	opts := args.GrafanaOpts
// 	// 	if opts.BuildEnterprise != true {
// 	// 		t.Fatal("args.BuildEnterprise should be true")
// 	// 	}
// 	// })
//
// 	t.Run("If the --enterprise-ref is set to a non-default value, it should set the enterprise flag to true", func(t *testing.T) {
// 		data := validData
// 		data["enterprise"] = false
// 		data["enterprise-ref"] = ""
// 		data["enterprise-dir"] = filepath.Join(enterpriseDir, "does-not-exist")
//
// 		_, err := pipelines.PipelineArgsFromContext(context.Background(), &TestCLIContext{
// 			Data: data,
// 		})
// 		if err == nil {
// 			t.Fatal("error should not be empty")
// 		}
// 	})
// }
