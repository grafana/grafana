+++
title = "Transform using value mapping"
weight = 10
+++

# Transform using value mapping

## Value mappings

You can also transform a query result into value mappings. This is is a bit different as here every row in the config query result will be used to define a single value mapping row. See example below.

Config query result:

| Value | Text   | Color |
| ----- | ------ | ----- |
| L     | Low    | blue  |
| M     | Medium | green |
| H     | High   | red   |

In the field mapping specify:

| Field | Use as                  | Select     |
| ----- | ----------------------- | ---------- |
| Value | Value mappings / Value  | All values |
| Text  | Value mappings / Text   | All values |
| Color | Value mappings / Ciolor | All values |

Grafana will build the value mappings from you query result and apply it the the real data query results. You should see values being mapped and colored according to the config query results.

Another source input...

### Condition

This column lists the type of condition a value mapping is triggered by and the values.

You can map values to three different conditions:

- **Value** maps text values to a color or different display text. For example, if a value is `10`, I want Grafana to display **Perfection!** rather than the number.
- **Range** maps numerical ranges to a display text and color. For example, if a value is within a certain range, I want Grafana to display **Low** or **High** rather than the number.
- **Regex** maps regular expressions to replacement text and a color. For example, if a value is 'www.example.com', I want Grafana to display just **www**, truncating the domain.
- **Special** maps special values like `Null`, `NaN` (not a number), and boolean values like `true` and `false` to a display text and color. For example, if Grafana encounters a `null`, I want Grafana to display **N/A**.

You can also use the dots on the left as a "handle" to drag and reorder value mappings in the list.

### Display text

The _display text_ is what Grafana displays instead of a number when the listed condition is met.

You can enter any Ascii character or emoji in this field.

### Color

You can select a color to for Grafana to display the value mapping text in.

- **Set color -** Click **Set color** to see a range of recommended colors. Click **Custom** to choose your own color.
- **Text color -** The primary text color for the current theme, i.e. white in dark theme and black in light theme.
- **Transparent -** Makes the color transparent so that the value mapping color shows whatever color is behind it, such as a panel background color.

![Set color](/static/img/docs/value-mappings/set-color-8-0.png)

### Copy icon

Click the copy icon in the value mapping row that you want to copy.

### Trash icon

Click the trash can icon to delete a value mapping. Once deleted, you cannot recover it.
