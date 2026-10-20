// The kind is named Kind, so grafana-app-sdk generates both a type and a func
// named Kind in pkg/generated/kind/v1alpha1, which doesn't compile. Rename the
// func, and its callers, to KindKind.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const rewrite = (file, replacements) => {
  const before = readFileSync(file, 'utf8');
  const after = replacements.reduce((s, [from, to]) => s.replace(from, to), before);
  if (after !== before) {
    writeFileSync(file, after);
  }
};

const kindDir = 'pkg/generated/kind/v1alpha1';
for (const name of readdirSync(kindDir).filter((n) => n.endsWith('.go'))) {
  rewrite(join(kindDir, name), [[/(?<![\w.])Kind\(\)/g, 'KindKind()']]);
}
for (const name of readdirSync('pkg/generated/manifestdata').filter((n) => n.endsWith('.go'))) {
  rewrite(join('pkg/generated/manifestdata', name), [[/\bkindv1alpha1\.Kind\(\)/g, 'kindv1alpha1.KindKind()']]);
}
