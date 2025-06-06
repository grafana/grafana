# How to add a new icon

- Add the new icon svg to the `unicons/` directory
  - Yes, even if it's not a unicon icon or from [IconScout](https://iconscout.com/unicons/solid-icons)
  - We will eventually condense all the separate folders into a single `icons/` directory, and since `unicons/` is the default it makes sense to add new icons there
- Add the new icon path to `public/app/core/icons/cached.json`
- Ensure the new icon source is formatted correctly:
  - Remove any `width` or `height` attributes
  - If the icon is a single color, ensure any explicitly defined fill or stroke colors are either removed (or set to `currentColor` if a color must be defined)
    - This allows the consumer to control the color of the `Icon`, which is useful for hover/focus states
- Modify the [`availableIconsIndex` map in `@grafana/data`](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/icon.ts#L1) and add the new icon
  - **Note:** the key must exactly match the icon filename, e.g. if your new icon is `my-icon.svg`, the key must be `my-icon`
- Run `yarn storybook` and verify the new icon appears correctly in the `Icon` story
