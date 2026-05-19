package v1beta1

ReceiverSpec: {
	title: string
	integrations: [...#Integration]
}

#Integration: {
	uid?:                   string
	type:                   string
	version:                string
	disableResolveMessage?: bool
	settings: {
		[string]: _
	}
	secureFields?: [string]: bool
}
