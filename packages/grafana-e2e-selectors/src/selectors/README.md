# Versioned selectors

The selectors defined in [pages.ts](./pages.ts) and [components.ts](./components.ts) are versioned. A versioned selector consists of an object literal where value is the selector context and key is the minimum Grafana version for which the value is valid. The versioning is important in plugin end-to-end testing, as it allows them to resolve the right selector values for a given Grafana version.

## How to change the value of an existing selector

1. Find the versioned selector object in [pages.ts](./pages.ts) or [components.ts](./components.ts).
2. Add a new key representing the minimum Grafana version. The version you specify should correspond to the version of Grafana where your changes will be released. In most cases, you can check the version specified in package.json of the main branch (`git show main:package.json | awk -F'"' '/"version": ".+"/{ print $4; exit; }'`), but if you know in advance that your change will be backported you can specify the version of the release with the lowest version number. The version you specify should not include tags such as `-pre` or build number.
3. Add a value for the selector. Remember that the selector needs to be backwards compatible, so you cannot change its signature.

## How to add a new selector

> [!CAUTION]
> If you're changing a part of the UI that already has a selector defined, you should reuse the existing selector to avoid breaking end-to-end tests in plugins.

1. Add a new versioned selector object under an existing or new group in [pages.ts](./pages.ts) or [components.ts](./components.ts).
2. Add a new key representing the minimum Grafana version. The version you specify should correspond to the version of Grafana where this change will be released. You can check the version specified in package.json of the main branch (`git show main:package.json | awk -F'"' '/"version": ".+"/{ print $4; exit; }'`). The version you specify should not include tags such as `-pre` or build number.
3. Add a value for the selector. Prefer using string selectors as function selectors such as `selectors.components.Panels.Panel.title('Header')` require context awareness which makes them hard to use in end-to-end tests.
