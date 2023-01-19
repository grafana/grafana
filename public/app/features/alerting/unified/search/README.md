# Alerting search syntax

Alerting uses [Lezer](https://lezer.codemirror.net/) parser system to create a search syntax grammar.

File [search.grammar](search.grammar) describes the search grammar.

`@lezer/generator` package is used to generate [search.js](search.js) and [search.terms.js](search.terms.js) files which includes a JS grammar parser.

## Changing the grammar

After making changes in the `search.grammar` file a new version of parser needs to be generated.
To do that the following command needs to be run in the `public/app/features/alerting/unified/search` directory

```sh
yarn dlx @lezer/generator search.grammar -o search.js
```

The command will re-create [search.js](search.js) and [search.terms.js](search.terms.js) files which are the files containing grammar parser.
