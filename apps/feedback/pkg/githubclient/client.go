package githubclient

type Client interface {
	UploadImage(image string) string
	CreateIssue(issue Issue) string
}

const logPrefix = "feedback.githubclient"
