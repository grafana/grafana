package cloudwatch

import (
	"os"
	"testing"

	"github.com/aws/aws-sdk-go/aws/credentials/ec2rolecreds"
	"github.com/aws/aws-sdk-go/aws/credentials/endpointcreds"
	"github.com/aws/aws-sdk-go/aws/session"
	. "github.com/smartystreets/goconvey/convey"
)

func TestECSCredProvider(t *testing.T) {
	Convey("Running in an ECS container task", t, func() {
		defer os.Clearenv()
		os.Setenv("AWS_CONTAINER_CREDENTIALS_RELATIVE_URI", "/abc/123")

		sess, _ := session.NewSession()
		provider := remoteCredProvider(sess)

		So(provider, ShouldNotBeNil)

		ecsProvider, ok := provider.(*endpointcreds.Provider)
		So(ecsProvider, ShouldNotBeNil)
		So(ok, ShouldBeTrue)

		So(ecsProvider.Client.Endpoint, ShouldEqual, "http://169.254.170.2/abc/123")
	})
}

func TestDefaultEC2RoleProvider(t *testing.T) {
	Convey("Running outside an ECS container task", t, func() {
		sess, _ := session.NewSession()
		provider := remoteCredProvider(sess)

		So(provider, ShouldNotBeNil)

		ec2Provider, ok := provider.(*ec2rolecreds.EC2RoleProvider)
		So(ec2Provider, ShouldNotBeNil)
		So(ok, ShouldBeTrue)
	})
}
