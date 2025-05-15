package v0alpha1

ReceiverSpec: {
	title: string
	integrations: [...#Integration]
}

#Integration: {
	uid?:                   string
	type:                   string
	disableResolveMessage?: bool
	settings: {
		[string]: _
	}
	secureFields?: [string]: bool
}
