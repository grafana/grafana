---
title: Tooltip from field
---

Toggle the **Tooltip from field** to render the value from another field (or column) in a tooltip.
You do this by selecting the source field in the drop-down list.
All table fields are in the drop-down list, whether visible or hidden.

To see the tooltip, hover over the chip in the top-right or top-left corner of the cell.

{{< admonition type="note" >}}
The placement of the chip follows the column header alignment to avoid interfering with other options.
{{< /admonition >}}

The tooltip displays the value from the source field from that data row
If you set it as a cell option, it's applied to all cells in the table.
Typically this is used as an override on a sub-set of cells as in the following example.

For example, the following table has....
![screenshot]()
It includes a column for status, but that column is currently hidden using the [x option under x]().
However, you can use the status values as a tooltips for another column by using the tooltip from field as an override.
In this case, tooltip by field option is set up as an override for the x column as shown in the following image.
![screenshot]()
Now when you hover the cursor over the chip in the x column, the corresponding values from the Status column appear in the tooltip.

The content of the tooltip is determined by the values of the source field and cannot be directly edited.
You can, however, use field overrides like a value mappings on the source field to manipulate the display of that value.
For example, if the status column is being used as the source field for the tooltip values, you could set up a value mapping for the status values. 
In this case, the status values are mapped to the word Good, Bad, and Okay:
![screenshot]()
Now when you hover the cursor over the chip in the x column, the mapped values appear in the tooltip
![screenshot]()

When you toggle on the switch, the **Tooltip placement** option is displayed, which controls where the tooltip box opens upon hover.
Select one of the following options:

- Auto
- Top
- Right
- Bottom
- Left
