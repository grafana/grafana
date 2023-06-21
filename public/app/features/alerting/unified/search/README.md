# Alerting search syntax

## Lezer grammar

Alerting uses the [Lezer](https://lezer.codemirror.net/) parser system to create a search syntax grammar.

File [search.grammar](search.grammar) describes the search grammar.

`@lezer/generator` package is used to generate [search.js](search.js) and [search.terms.js](search.terms.js) files which include a JS grammar parser.

## Changing the grammar

After making changes in the `search.grammar` file, a new version of the parser needs to be generated.
To do that, the following command needs to be run in the `public/app/features/alerting/unified/search` directory

```sh
yarn dlx @lezer/generator search.grammar -o search.js
```

The command will re-create [search.js](search.js) and [search.terms.js](search.terms.js) files which are the files containing grammar parser.

## Extensibility

The `search.grammar` uses the [dialects feature](https://lezer.codemirror.net/docs/guide/#dialects) of Lezer to enable parsing of each filter term separately.

This will allow us to have a single grammar file for handling filter expressions for all of our filters (e.g. Rules, Silences, Notification policies).
Then we can configure the required set of filters dynamically in the JS code using the parser.
