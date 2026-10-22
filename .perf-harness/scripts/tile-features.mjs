import MVT from 'ol/format/MVT.js';
const [z, x, y, pattern] = process.argv.slice(2);
const base = process.env.TILES ?? 'http://localhost:8095/tiles/{z}/{x}/{y}.mvt';
const buf = await (await fetch(base.replace('{z}', z).replace('{x}', x).replace('{y}', y))).arrayBuffer();
const fmt = new MVT();
const feats = fmt.readFeatures(buf, { extent: [0, 0, 4096, 4096], featureProjection: 'EPSG:3857' });
const re = new RegExp(pattern, 'i');
for (const f of feats) {
  const p = f.getProperties();
  if (re.test(String(p.name ?? ''))) {
    const { geometry, ...rest } = p;
    console.log(p.layer, JSON.stringify(rest));
  }
}
