---
title: Shared Content
---

Use test.md to experiment and test formats and syntax.

## Standalone text

When you have a chunk of text or steps that stand alone, not part of an ordered or unordered list. This includes headings, paragraphs, full lists, and combinations of those content types.

The syntax to invoke this file would be the following, minus the backslash:

```
\{{< docs/shared "example.md" >}}
```

## Part of a list

When you have steps that you want to use in more than one numbered list. This format does not work as well for unordered lists, but it does work.

### Ordered list

Below is an example from the docs, with backslashes added. The initial spaces are not necessary for the numbered list to work and make no difference in the output, but they aid in code readability.

```
\{{< docs/list >}}
  \{{< docs/shared "manage-users/view-server-user-list.md" >}}
  1. Click the user account that you want to edit. If necessary, use the search field to find the account.
\{{< /docs/list >}}
```

You cannot use short codes in an ordered list with sublists. The shortcode breaks the sublist indentation.

### Unordered list

All unordered list steps included as part of a list will appear as second-level lists (with the hollow circle bullet) rather than first-level lists (solid circle bullet), even if the list is not indented in the shared file or the document file.

{{< docs/list >}}
{{< docs/shared "test.md" >}}

- Bullet text
  {{< /docs/list >}}
