# token-search

The rule list's search model from before the reviewed search (`../rule-search/`) landed: token definitions, the serializer, filter issues and the filter sidebar building blocks.

The filter sidebars, saved searches and the legacy URL migration still build on it. Each of those moves to `../rule-search/` (`FilterDefinition`, `alertFilters`, `recordingFilters`) when its slice is cut, and this folder goes away with the last one. Don't add new users of it.
