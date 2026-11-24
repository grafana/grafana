# Icon and link actions

Don't strip a `Button`'s styling to make it look like a link or a bare icon. Pick the component built for that job.

| You need                                          | Use                                                                      |
| ------------------------------------------------- | ------------------------------------------------------------------------ |
| Navigation inside text                            | `TextLink` with `href`                                                   |
| Navigation that looks like a button               | `LinkButton` with `href`, and `fill="text"` for low emphasis             |
| An action shown as an icon only                   | `IconButton` with `name` and `tooltip` (or `aria-label`)                 |
| An action inside a sentence or a line of data     | `InlineButton`, see [inline actions](./inline-actions.md)                |
| A low-emphasis action with standard button sizing | `Button` with `fill="text"`, without padding, border or height overrides |

## Icon-only actions

Don't reset a text button to get a bare icon:

```tsx
<Button
  fill="text"
  icon="times"
  aria-label="Remove"
  className={css({ padding: 0, height: 'auto', border: 'none' })}
  onClick={onRemove}
/>
```

`Button` merges `className` after its own styles, so the reset wins in the default state, but not everywhere. The hover background still appears, and a disabled button gets its transparent 1px border back from the disabled styles. An icon-only `Button` also gives its icon negative side margins sized for the default padding, so with `padding: 0` the icon overhangs the button's edges. The reset also drifts from the theme whenever `Button`'s styles change.

Use `IconButton`:

```tsx
<IconButton name="times" tooltip="Remove" onClick={onRemove} />
```

A string `tooltip` is also the accessible name. If the icon is unambiguous and a tooltip doesn't help, pass `aria-label` instead and no tooltip is shown.

## Navigation

Don't navigate from a restyled button:

```tsx
<Button fill="text" className={css({ padding: 0 })} onClick={() => locationService.push('/dashboards')}>
  Dashboards
</Button>
```

A `<button>` has no `href`, so users can't open the page in a new tab or copy the link, and assistive technology announces a button rather than a link.

Use a link component:

```tsx
<TextLink href="/dashboards">Dashboards</TextLink>

<LinkButton href="/dashboards" fill="text">
  Dashboards
</LinkButton>
```

`TextLink` and `LinkButton` render an anchor. `LinkButton` accepts the same `variant`, `fill`, `size` and `icon` props as `Button`.

## Clearing button styles

`clearButtonStyles` only resets background, color, border and padding. It adds no hover, focus or disabled styles, so a raw `<button>` that uses it has to provide all of them. Prefer `IconButton`, `InlineButton` or `TextLink` when one fits.

## Do's and don'ts

- Do use `IconButton` for an icon-only action. Don't reset `Button` padding, height and border to fake one.
- Do use `TextLink` or `LinkButton` with `href` for navigation. Don't navigate from a button's `onClick` when the target is a URL.
- Do use `Button fill="text"` as is for a low-emphasis action. Don't add overrides that strip its padding or border.
