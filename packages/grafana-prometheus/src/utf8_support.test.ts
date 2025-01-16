import { escapeForUtf8Support, utf8Support } from './utf8_support';

describe('utf8 support', () => {
  it('should return utf8 labels wrapped in quotes', () => {
    const labels = ['valid:label', 'metric_label', 'utf8 label with space 🤘', ''];
    const expected = ['valid:label', 'metric_label', `"utf8 label with space 🤘"`, ''];
    const supportedLabels = labels.map(utf8Support);
    expect(supportedLabels).toEqual(expected);
  });
});

describe('applyValueEncodingEscaping', () => {
  it('should return utf8 labels wrapped in quotes', () => {
    const labels = [
      'no:escaping_required',
      'mysystem.prod.west.cpu.load',
      'mysystem.prod.west.cpu.load_total',
      'http.status:sum',
      'my lovely_http.status:sum',
      '花火',
      'label with 😱',
    ];
    const expected = [
      'no:escaping_required',
      'U__mysystem_2e_prod_2e_west_2e_cpu_2e_load',
      'U__mysystem_2e_prod_2e_west_2e_cpu_2e_load__total',
      'U__http_2e_status:sum',
      'U__my_20_lovely__http_2e_status:sum',
      'U___82b1__706b_',
      'U__label_20_with_20__1f631_',
    ];
    const excapedLabels = labels.map(escapeForUtf8Support);
    expect(excapedLabels).toEqual(expected);
  });
});
