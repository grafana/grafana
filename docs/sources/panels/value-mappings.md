+++
title = "Value mappings"
weight = 600
+++

## Value mappings

Value mappings come in different types.

* **Range** maps numerical ranges to a display text and color. 
* **Value** maps text values to a color or different display text.
* **Special** maps special values like `Null`, `NaN` and boolean values like `true` and `false` to a display text and color.

The display text and color are both optional. If you only want to assign colors to text values you can leave the display text empty and the original value will be used for display.

Values mapped via value mappings will skip the unit formatting. This means that a text value mapped to a numerical value will not be formatted using the configured unit.