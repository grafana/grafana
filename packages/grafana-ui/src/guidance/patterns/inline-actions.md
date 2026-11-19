# Inline actions

Use `InlineButton` for actions within text or data, such as opening a details dialog.
Don't make a `Button` look inline by stripping its padding and border with `className`:

```tsx
<Button fill="text" className={css({ padding: 0, border: 'none' })} onClick={openDetails}>
  Show details
</Button>
```

The reset overrides the button's theme-based padding and transparent border but leaves
its fixed height and button typography. `InlineButton` inherits the surrounding font and
line height and aligns to the text baseline:

```tsx
<InlineButton onClick={openDetails}>Show details</InlineButton>
```

Use `Button fill="text"` without those overrides for a low-emphasis action that should
keep standard button sizing.
