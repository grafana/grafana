import json,sys,urllib.request
def get(u): return json.load(urllib.request.urlopen(u))
for name,u in [("CARTO","https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"),("PM","http://localhost:8095/styles/white.json")]:
  s=get(u); print("==",name)
  for l in s["layers"]:
    if l["type"]!="symbol": continue
    lo=l.get("layout",{})
    keep={k:lo[k] for k in ("symbol-placement","symbol-spacing","text-padding","text-max-angle","symbol-sort-key") if k in lo}
    sz=json.dumps(lo.get("text-size"))[:60]
    print(f'{l["id"]:<32} min {l.get("minzoom","-")!s:<4} max {l.get("maxzoom","-")!s:<4} size {sz:<60} {json.dumps(keep)[:110]}')
