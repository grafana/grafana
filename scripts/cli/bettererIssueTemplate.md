Hi <%= owner %>!

The following files have been marked as having issues regarding `<%= issueFilter %>: <%= issueMessageFilter %>`.

There are <%= totalIssueCount %> <%= plural('issue', totalIssueCount) %> over <%= fileCount %> <%= plural('file', fileCount) %>:
<% files.forEach((file) => { %>
- [ ] <%= file.issueCount %> <%= plural('issue', file.issueCount) %> in `<%= file.fileName %>` <% }) %>
