import Prism from 'prismjs';

import { tokenizer } from './syntax';

describe('Loki syntax', () => {
  it('should highlight Loki query correctly', () => {
    expect(Prism.highlight('key=value', tokenizer, 'tempo')).toBe(
      '<span class="token key attr-name">key</span><span class="token operator">=</span><span class="token value">value</span>'
    );
    expect(Prism.highlight('root.ip=172.123.0.1', tokenizer, 'tempo')).toBe(
      '<span class="token key attr-name">root.ip</span><span class="token operator">=</span><span class="token value">172.123.0.1</span>'
    );
    expect(Prism.highlight('root.name="http get /config"', tokenizer, 'tempo')).toBe(
      '<span class="token key attr-name">root.name</span><span class="token operator">=</span><span class="token value">"http get /config"</span>'
    );
    expect(Prism.highlight('key=value key2=value2', tokenizer, 'tempo')).toBe(
      '<span class="token key attr-name">key</span><span class="token operator">=</span><span class="token value">value</span> <span class="token key attr-name">key2</span><span class="token operator">=</span><span class="token value">value2</span>'
    );
  });
});
