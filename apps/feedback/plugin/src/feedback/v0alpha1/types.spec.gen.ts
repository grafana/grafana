// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface Spec {
	message: string;
	screenshot?: string;
	imageType?: string;
	screenshotUrl?: string;
	githubIssueUrl?: string;
	canContactReporter: boolean;
	canAccessInstance: boolean;
	diagnosticData?: Record<string, any>;
}

export const defaultSpec = (): Spec => ({
	message: "",
	canContactReporter: false,
	canAccessInstance: false,
});

