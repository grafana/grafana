# Styling a component's internal elements

Don't reach into a Grafana UI component with structural selectors such as `:nth-child`, `> div` or generated class names. A component's markup isn't part of its API, so these selectors break without warning when the markup changes.

## Use the component's props

Don't target an internal wrapper by position:

```tsx
<Modal
  title="Edit query"
  isOpen={isOpen}
  onDismiss={onDismiss}
  className={css({ '& > div:nth-child(2)': { padding: 0 } })}
>
  {editor}
</Modal>
```

`Modal` passes `className` to the dialog element, whose children are the header and the content wrapper. The selector depends on that order and on both being `div` elements.

Use the prop that styles the part you want:

```tsx
<Modal title="Edit query" isOpen={isOpen} onDismiss={onDismiss} contentClassName={css({ padding: 0 })}>
  {editor}
</Modal>
```

Some props that cover common adjustments:

| Component | Props                                                          |
| --------- | -------------------------------------------------------------- |
| `Alert`   | `bottomSpacing`, `topSpacing`, `elevated`                      |
| `Button`  | `size`, `fill`, `variant`, `fullWidth`                         |
| `Field`   | `noMargin`, `horizontal`                                       |
| `Modal`   | `className` for the dialog, `contentClassName` for the content |

`className` on most components styles the root element only. Use it for placement, such as margins or width, rather than to select the elements inside.

If no prop covers the change you need, propose one in `@grafana/ui` instead of targeting internals.

## Space children with layout components

Don't use `:nth-child` or `:not(:last-child)` rules to space Grafana UI components:

```tsx
<div className={css({ '& > *:not(:last-child)': { marginRight: theme.spacing(1) } })}>
  <Button variant="secondary">Cancel</Button>
  <Button>Save</Button>
</div>
```

Use `Stack` with `gap`:

```tsx
<Stack gap={1}>
  <Button variant="secondary">Cancel</Button>
  <Button>Save</Button>
</Stack>
```

## Do's and don'ts

- Do use the props a component provides, such as `contentClassName` on `Modal` or `noMargin` on `Field`. Don't select its internal elements with `:nth-child`, `> div` or class names.
- Do use `className` to place the component itself. Don't use it to restyle elements inside the component.
- Do use `Stack` or `Grid` with `gap` to space components. Don't add spacing with `:nth-child` rules.
