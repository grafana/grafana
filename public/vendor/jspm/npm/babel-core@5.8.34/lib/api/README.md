## API

In this directory you'll find all the public interfaces to using Babel for both
node and the browser.

### Node

There are two ways people use Babel within Node, they either are manipulating
strings of code with `babel.transform` or `babel.parse`, they also might be
running their code through Babel before execution via `register` or `polyfill`.

### Browser

Usage of Babel in the browser is extremely uncommon and in most cases
considered A Bad Idea™. However it works by loading `<script>`'s with XHR,
transforming them and then executing them. These `<script>`'s need to have a
`type` of "text/ecmascript-6", "text/babel", or "module" ("text/6to5" exists as
well for legacy reasons).
