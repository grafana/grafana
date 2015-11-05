
export class TableRenderer {
  constructor(private panel, private table) {
  }

  formatColumnValue(columnIndex, value) {
    return "value";
  }

  renderCell(columnIndex, value) {
    var colValue = this.formatColumnValue(columnIndex, value);
    return '<td>' + colValue + '</td>';
  }

  render(page) {
    let endPos = Math.min(this.panel.pageSize, this.table.rows.length);
    let startPos = 0;
    var html = "";

    for (var y = startPos; y < endPos; y++) {
      let row = this.table.rows[y];
      html += '<tr>';
      for (var i = 0; i < this.table.columns.length; i++) {
        html += this.renderCell(i, row[i]);
      }
      html += '</tr>';
    }

    return html;
  }
}
