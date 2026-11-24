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
<ToolbarButton icon="eye" variant={isActive ? 'active' : 'default'} aria-pressed={isActive}>
  Preview
</ToolbarButton>

<Tab label="Overview" active={activeTab === 'overview'} onChangeTab={() => setActiveTab('overview')} />
```

`variant="active"` only styles `ToolbarButton`, so also set `aria-pressed` for a toggle, or `aria-expanded` when it opens something. `Tab` sets `aria-selected` from `active` for you. To choose one value from a small set, use `RadioButtonGroup` with `options`, `value` and `onChange`.

## Invalid

Don't color an input's border by hand to show an error:

```tsx
<Input className={css({ '& input': { borderColor: theme.colors.error.border } })} value={name} onChange={onChange} />
```

`Input` applies `className` to its wrapper, so this reaches into its markup. The input only looks invalid: it isn't marked with `aria-invalid`, and no message says what's wrong.

Set `invalid` on the input, or `invalid` and `error` on its `Field`:

```tsx
<Field label="Name" invalid={!name} error="Name is required">
  <Input id="name" value={name} onChange={onChange} />
</Field>
```

`Input` then sets `aria-invalid` and uses the theme's error border colors, including on hover. `Field` shows the `error` message below the input and links it with `aria-describedby`.

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
- Do use state props such as `ToolbarButton` `variant="active"` (with `aria-pressed`) and `Tab` `active`. Don't force hover or highlight colors with a class.
- Do set `invalid` on the input or `invalid` and `error` on its `Field`. Don't color the border red by hand.
- Do keep the component's focus ring. Don't override `:focus` or `:focus-visible` to remove it.
