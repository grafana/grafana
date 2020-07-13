# 7.1.0-beta1 (2020-07-01)

### Features / Enhancements
* **Grafana-UI**: Add FileUpload. [#25835](https://github.com/grafana/grafana/pull/25835), [@Clarity-89](https://github.com/Clarity-89)
* **Switch**: Deprecate checked prop in favor of value. [#25862](https://github.com/grafana/grafana/pull/25862), [@tskarhed](https://github.com/tskarhed)
  

# 7.0.4 (2020-06-25)

### Features / Enhancements
* **Slider**: Update rc-slider dependency to 9.3.1. [#25617](https://github.com/grafana/grafana/pull/25617), [@torkelo](https://github.com/torkelo)

# 7.0.0 (2020-05-18)

### Bug Fixes

* **Explore**: Fixes loading more logs in logs context view. [#24135](https://github.com/grafana/grafana/pull/24135), [@Estrax](https://github.com/Estrax)

# 7.0.0-beta3 (2020-05-08)

### Features / Enhancements

- **Forms**: Remove Forms namespace [BREAKING]. Will cause all `Forms` imports to stop working. See migration guide below. [#24378](https://github.com/grafana/grafana/pull/24378), [@tskarhed](https://github.com/tskarhed)

# 7.0.0-beta.2 (2020-05-07)

### Bug Fixes

- **Dashboard**: Fix for folder picker menu not being visible outside modal when saving dashboard. [#24296](https://github.com/grafana/grafana/pull/24296), [@tskarhed](https://github.com/tskarhed)
- **Select**: Fixes so component loses focus on selecting value or pressing outside of input. [#24008](https://github.com/grafana/grafana/pull/24008), [@mckn](https://github.com/mckn)

# 7.0.0-beta.1 (2020-04-28)

## Breaking changes

### @grafana/ui forms migration notice

In Grafana 7 we have migrated from our old form components to `LegacyForms` namespace. The new components were previously available under the `Forms` namespace.

All the following components were moved to the LegacyForms namespace, and some replaced with the new form components:

- `SecretFormField`
- `FormField`
- `Select`
- `AsyncSelect`
- `IndicatorsContainer`
- `NoOptionsMessage`
- `ButtonSelect`
- `Input`
- `Switch`

One exception to this is `FormLabel`, which has been renamed to `InlineFormLabel`.

If you were previously using the legacy form styles and your plugin is breaking, change from this:

```jsx
import { Switch } from '@grafana/ui';
…
<Switch .../>
```

To this:

```jsx
import { LegacyForms } from '@grafana/ui';
…
<LegacyForms.Switch ... />
```

If you were previously using the new form styles under the `Forms` namespace, change from this:

```jsx
import { Forms } from '@grafana/ui';
…
<Forms.Switch ... />
```

To this:

```jsx
import { Switch} from '@grafana/ui';
…
<Switch ... />
```

To see the new form components visit [our Storybook](https://developers.grafana.com/ui)

### Create custom value with Select

Previously the only thing you had to do to enable creating a custom value with Select was to add the `allowCustomValue` prop. Now you also have to add a `onCreateOption` handler.

Before:

```jsx
import { Select } from '@grafana/ui';
...
<Select
...
allowCustomValue
/>

```

After:

```jsx
import { Select } from '@grafana/ui';
...
<Select
...
allowCustomValue
onCreateOption={(customValue) => {
    // Do things with the customValue
}}
/>

```

### Features / Enhancements

- **@grafana/ui**: Create Icon component and replace icons. [#23402](https://github.com/grafana/grafana/pull/23402), [@ivanahuckova](https://github.com/ivanahuckova)
- **@grafana/ui**: Create slider component. [#22275](https://github.com/grafana/grafana/pull/22275), [@ivanahuckova](https://github.com/ivanahuckova)
- **@grafana/ui**: Remove ColorPalette component. [#23592](https://github.com/grafana/grafana/pull/23592), [@ivanahuckova](https://github.com/ivanahuckova)
- **Components**: IconButton. [#23510](https://github.com/grafana/grafana/pull/23510), [@torkelo](https://github.com/torkelo)
- **Docs**: Adding API reference documentation support for the packages libraries. [#21931](https://github.com/grafana/grafana/pull/21931), [@mckn](https://github.com/mckn)
- **Migration**: Add old Input to legacy namespace. [#23286](https://github.com/grafana/grafana/pull/23286), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Final components to LegacyForms. [#23707](https://github.com/grafana/grafana/pull/23707), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Move Switch from Forms namespace. [#23386](https://github.com/grafana/grafana/pull/23386), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Move last components from Forms namespace. [#23556](https://github.com/grafana/grafana/pull/23556), [@tskarhed](https://github.com/tskarhed)
- **Migration**: Remove Button from Forms namespace. [#23105](https://github.com/grafana/grafana/pull/23105), [@tskarhed](https://github.com/tskarhed)
- **Migration**: TextArea from Forms namespace. [#23436](https://github.com/grafana/grafana/pull/23436), [@tskarhed](https://github.com/tskarhed)
- **grafana/ui**: Add basic horizontal and vertical layout components. [#22303](https://github.com/grafana/grafana/pull/22303), [@dprokop](https://github.com/dprokop)

### Bug Fixes

- **@grafana/ui**: Fix time range when only partial datetime is provided. [#23122](https://github.com/grafana/grafana/pull/23122), [@ivanahuckova](https://github.com/ivanahuckova)

# 6.6.0-beta.1.0 (2020-01-20)

### Features / Enhancements

- **Forms**: introduce RadioButtonGroup. [#20828](https://github.com/grafana/grafana/pull/20828), [@dprokop](https://github.com/dprokop)
- **grafana/ui**: ConfirmModal component. [#20965](https://github.com/grafana/grafana/pull/20965), [@alexanderzobnin](https://github.com/alexanderzobnin)
- **grafana/ui**: Create Tabs component. [#21328](https://github.com/grafana/grafana/pull/21328), [@peterholmberg](https://github.com/peterholmberg)
- **grafana/ui**: New table component. [#20991](https://github.com/grafana/grafana/pull/20991), [@peterholmberg](https://github.com/peterholmberg)
- **grafana/ui**: New updated time picker. [#20931](https://github.com/grafana/grafana/pull/20931), [@mckn](https://github.com/mckn)

### Bug Fixes

- **API**: Optionally list expired API keys. [#20468](https://github.com/grafana/grafana/pull/20468), [@papagian](https://github.com/papagian)
- **grafana/ui**: Do not build grafana/ui in strict mode as it depends on non-strict libs. [#21319](https://github.com/grafana/grafana/pull/21319), [@dprokop](https://github.com/dprokop)

# 6.0.0-alpha.0 (2019-02-22)

Version update to 6.0.0 to keep @grafana/ui version in sync with [Grafana](https://github.com/grafana/grafana)

# 1.0.0-alpha.0 (2019-02-21)

First public release
