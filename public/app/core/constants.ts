export const GRID_CELL_HEIGHT = 30;
export const GRID_CELL_VMARGIN = 10;
export const GRID_COLUMN_COUNT = 24;
export const REPEAT_DIR_VERTICAL = 'v';

export const DEFAULT_PANEL_SPAN = 4;
export const DEFAULT_ROW_HEIGHT = 250;
export const MIN_PANEL_HEIGHT = GRID_CELL_HEIGHT * 3;

export const LS_PANEL_COPY_KEY = 'panel-copy';

export const DASHBOARD_TOOLBAR_HEIGHT = 55;
export const DASHBOARD_TOP_PADDING = 20;

/*
 * This regex matches 3 types of variable reference with an optional format specifier
 * \$(\w+)                          $var1
 * \[\[([\s\S]+?)(?::(\w+))?\]\]    [[var2]] or [[var2:fmt2]]
 * \${(\w+)(?::(\w+))?}             ${var3} or ${var3:fmt3}
 */
export const variableRegex = /\$(\w+)|\[\[([\s\S]+?)(?::(\w+))?\]\]|\${(\w+)(?::(\w+))?}/g;

export const variableRegexExec = (variableString: string) => {
  variableRegex.lastIndex = 0;
  return variableRegex.exec(variableString);
};
