# How to add a new icon

- Add the new icon svg to the `unicons/` directory
- If the icon is a single color, ensure any explicitly defined fill or stroke colors are either removed or set to `currentColor`
  - This allows the consumer to control the color of the `Icon, which is useful for hover/focus states
- Modify the [`availableIconsIndex` map in `@grafana/data`](https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/types/icon.ts#L1) and add the new icon
  - **Note:** the key must exactly match the icon filename, e.g. if your new icon is `my-icon.svg`, the key must be `my-icon`
- Run `yarn storybook` and verify the new icon appears correctly in the `Icon` story
