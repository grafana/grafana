package v0alpha1

// A naming convention for the titles of folders in the namespace. A namespace may have several
// FolderNamingPolicies; a folder title must follow all of them.
//
// Only folders that are created, or whose title changes, are checked, so existing folders can
// still be moved or updated before they are renamed.
#FolderNamingPolicySpec: {
	// What happens when a folder title breaks the convention. Deny rejects the write. Warn admits
	// it with a warning, so a convention can be assessed before it is enforced.
	enforcement: #Enforcement
	// An RE2 regular expression the whole folder title must match, e.g. "[a-z0-9-]+: .+".
	titlePattern: string
	// Explains the convention to whoever breaks it, e.g. "Start with the owning team, like 'team-a: Alerts'".
	description?: string
}

#Enforcement: "Deny" | "Warn"

#FolderNamingPolicyStatus: {}
