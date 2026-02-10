package v1beta1

import "strings"

KeeperSpec: {
	// Short description for the Keeper.
	// +k8s:validation:minLength=1
	// +k8s:validation:maxLength=253
	description: string & strings.MinRunes(1) & strings.MaxRunes(253)

	// AWS Keeper Configuration.
	// +structType=atomic
	// +optional
	aws?: #AWSConfig
}

#AWSConfig: {
	region:      string
	accessKey?:  #AWSAccessKey
	assumeRole?: #AWSAssumeRole
	kmsKeyID?:   string
}

#AWSAccessKey: {
	accessKeyID:     #CredentialValue
	secretAccessKey: #CredentialValue
}

#AWSAssumeRole: {
	assumeRoleArn: string
	externalID:    string
}

#CredentialValue: {
	// The name of the secure value that holds the actual value.
	// +optional
	secureValueName: string
}
