package artifacts_test

// var TestArtifact struct {
// }
//
// func TestParse(t *testing.T) {
// 	v := "artifact:flag1:flag2"
//
// 	exampleArtifact := &pipeline.Artifact{
// 		Name: "example",
// 	}
//
// 	argument1 := &pipeline.Argument{
// 		Name: "argument1",
// 	}
//
// 	argument2 := &pipeline.Argument{
// 		Name: "argument2",
// 	}
//
// 	res, err := artifacts.Parse(v, map[string]artifacts.ArgumentOption{
// 		"artifact":  {Artifact: exampleArtifact},
// 		"argument1": {Arguments: []*pipeline.Argument{argument1}},
// 		"argument2": {Arguments: []*pipeline.Argument{argument2}},
// 	})
//
// 	if err != nil {
// 		t.Fatal(err)
// 	}
//
// 	if res.Artifact.Name != exampleArtifact.Name {
// 		t.Fatal("Parse should return the example artifact")
// 	}
//
// 	if len(res.Arguments) != 2 {
// 		t.Fatal("Parse should return 2 Arguments")
// 	}
// }
