# Markdown style guide

This guide for Markdown style helps keep contributions consistent across all documentation
created for Grafana products. Refer to the guide and update its sections as needed when a
Subject Matter Expert answers a question on Markdown style, or a decision is made about
how to apply Markdown.

## Headers

In Markdown, the number of "#" symbols creates different heading levels, similar to
HTML heading levels:

**Example**

* \# is \<h1>.
* \#\# is \<h2>.
* \#\#\# is \<h3>.

Start your document with a single ``#`` for the title of the page. Add the sub-headings with two ``##``.

## Bold and emphasis

* Make text **bold** using two asterisks.

**Example:** It is ``**important**`` to use Github Flavored Markdown emoji consistently.

* Make text ``*emphasized*`` using single `` _underscores_`` or a single asterisk.

**Example:** Github Flavored Markdown emoji should _only_ appear in specific cases.


## Links and references

Create links to other website by wrapping the display text in square brackets, and
the web URL in curved brackets.

\[text to display](www.website.com)

**Example:** For more information on including emoji in Github flavored Markdown, refer to the [webfx page on emoji](https://www.webfx.com/tools/emoji-cheat-sheet/) for a list of emoji.

## Block quotes

Include Block quotes inside text using right-facing arrows:

**Example**

> Any important information
> about emoji can be separated into
> a blockquote.

## Code blocks

Code blocks written with markdown can show off syntax highlighting specific
to different languages. Use three back tics to create a code block:

```
function testNum(a) {
  if (a > 0) {
    return "positive";
  } else {
    return "NOT positive";
  }
}
```

Write the name of the language after the first set of back tics, no spaces,
to show specific syntax highlighting. For example; "\```javascript" produces the following:

```javascript
function testNum(a) {
  if (a > 0) {
    return "positive";
  } else {
    return "NOT positive";
  }
}
```
## Tables

Construct a table by typing the table headings, and separating them with
a "|" character. Then, add a second line of dashes ("-") separated by
another "|" character. When constructing the table cells, separate each cell data with another
"|".

**Example**

Heading one | Heading two

\------------|------------

Cell one data| Cell two data

Will publish as:

Heading one | Heading two
------------|------------
Cell one data| Cell two data

## Lists

### Numbered lists

To avoid inconsistent list numbering, use repetitive list numbering:

\1. First

\1. Second

\1. Third

The list above will always display as:

1. First
2. Second
3. Third

### Unordered lists

Build a list of points - an unordered or unnumbered list - by
using "\*" characters.

**Example**

* First
* Another item
* The last list item

## Images

Include images in a document using the following syntax:

**Example** \!\[Grafana Logo](/link/to/grafanalogo/logo.png)

This follows the format of "!", alt text wrapped in "[]" and the link URL wrapped in "()".

## Comments

You can include comments that will not appear in published markdown using the
following syntax:

\[comment]: <> (Comment text to display)

The word "comment" wrapped in "[]" followed by a ":", a space, "<>", and then
the comment itself wrapped in "()".
