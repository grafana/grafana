import Prism from 'prismjs';

import promql from './promql';

describe('Loki syntax', () => {
  it('should highlight Loki query correctly', () => {
    expect(Prism.highlight('{key="val#ue"}', promql, 'promql')).toBe(
      '<span class="token context-labels"><span class="token punctuation">{</span><span class="token label-key attr-name">key</span>=<span class="token label-value attr-value">"val#ue"</span></span><span class="token punctuation">}</span>'
    );
    expect(Prism.highlight('{key="#value"}', promql, 'promql')).toBe(
      '<span class="token context-labels"><span class="token punctuation">{</span><span class="token label-key attr-name">key</span>=<span class="token label-value attr-value">"#value"</span></span><span class="token punctuation">}</span>'
    );
    expect(Prism.highlight('{key="value#"}', promql, 'promql')).toBe(
      '<span class="token context-labels"><span class="token punctuation">{</span><span class="token label-key attr-name">key</span>=<span class="token label-value attr-value">"value#"</span></span><span class="token punctuation">}</span>'
    );
    expect(Prism.highlight('#test{key="value"}', promql, 'promql')).toBe(
      '<span class="token comment">#test{key="value"}</span>'
    );
    expect(Prism.highlight('{key="value"}#test', promql, 'promql')).toBe(
      '<span class="token context-labels"><span class="token punctuation">{</span><span class="token label-key attr-name">key</span>=<span class="token label-value attr-value">"value"</span></span><span class="token punctuation">}</span><span class="token comment">#test</span>'
    );
  });
});
