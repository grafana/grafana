package team

import (
	"k8s.io/apimachinery/pkg/apis/meta/v1/unstructured"

	"github.com/grafana/grafana/pkg/tests/apis"
)

func createTeamObject(helper *apis.K8sTestHelper, teamName string, title string, email string) *unstructured.Unstructured {
	teamObj := helper.LoadYAMLOrJSONFile("../testdata/team-test-create-v0.yaml")
	teamObj.Object["metadata"].(map[string]any)["name"] = teamName
	teamObj.Object["spec"].(map[string]any)["title"] = title
	teamObj.Object["spec"].(map[string]any)["email"] = email

	return teamObj
}

func createTeamBindingObject(helper *apis.K8sTestHelper, userName, teamName string) *unstructured.Unstructured {
	obj := helper.LoadYAMLOrJSONFile("../testdata/teambinding-test-create-v0.yaml")
	obj.Object["spec"].(map[string]interface{})["subject"].(map[string]interface{})["name"] = userName
	obj.Object["spec"].(map[string]interface{})["teamRef"].(map[string]interface{})["name"] = teamName
	return obj
}
