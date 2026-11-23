# Interactive states

Use a component's state props to show that it's disabled, selected or active. Don't recreate those looks with CSS on top of the component.

## Disabled

Don't fake a disabled button with opacity and `pointer-events`:

```tsx
<Button className={css({ opacity: 0.5, pointerEvents: 'none' })} onClick={save}>
  Save
</Button>
```

The button only looks disabled. It stays in the tab order, assistive technology reports it as enabled, and pressing Enter or Space still runs `onClick`, because `pointer-events` only blocks the pointer.

Set `disabled` instead:

```tsx
<Button disabled onClick={save}>
  Save
</Button>
```

`Button` then applies the theme's disabled colors for its fill, keeps hover and focus from changing them, and doesn't call `onClick`. When the button also has a `tooltip`, it sets `aria-disabled` instead of the native `disabled` attribute, so the tooltip stays reachable.

## Selected and active

Don't copy hover or highlight colors into a class to mark the current item:

```tsx
<ToolbarButton icon="eye" className={cx(isActive && css({ background: theme.colors.action.hover }))}>
  Preview
</ToolbarButton>
```

The selected item then looks the same as one under the pointer, and the state exists only in your CSS.

Use the prop the component provides for that state:

```tsx
<ToolbarButton icon="eye" variant={isActive ? 'active' : 'default'}>
  Preview
</ToolbarButton>

<Tab label="Overview" active={activeTab === 'overview'} onChangeTab={() => setActiveTab('overview')} />
```

`Tab` also sets `aria-selected` from `active`. To choose one value from a small set, use `RadioButtonGroup` with `options`, `value` and `onChange`.

## Focus

Don't remove a component's focus ring:

```tsx
<Button className={css({ '&:focus': { outline: 'none', boxShadow: 'none' } })}>Run query</Button>
```

`Button` already shows its focus ring for keyboard focus (`:focus-visible`) and hides it for mouse focus. Removing it leaves keyboard users with no visible focus.

Leave the component's focus styles in place. For a custom interactive element that has no Grafana UI equivalent, use the shared mixins so the ring matches:

```tsx
import { styleMixins } from '@grafana/ui';

const getStyles = (theme: GrafanaTheme2) => ({
  item: css({
    '&:focus-visible': styleMixins.getFocusStyles(theme),
    '&:focus:not(:focus-visible)': styleMixins.getMouseFocusStyles(theme),
  }),
});
```

## Do's and don'ts

- Do set `disabled` to disable a control. Don't fake it with `opacity` or `pointer-events`.
- Do use state props such as `ToolbarButton` `variant="active"` and `Tab` `active`. Don't force hover or highlight colors with a class.
- Do keep the component's focus ring. Don't override `:focus` or `:focus-visible` to remove it.
