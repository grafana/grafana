import json,sys,urllib.request
def get(u): return json.load(urllib.request.urlopen(u))
pairs=[("dark","dark-matter"),("white","positron"),("light","positron")]
for pm,carto in pairs:
  for name,u in [(f"PM {pm}",f"http://localhost:8095/styles/{pm}.json"),(f"CARTO {carto}",f"https://basemaps.cartocdn.com/gl/{carto}-gl-style/style.json")]:
    s=get(u); print("==",name, "bg", [l.get("paint",{}).get("background-color") for l in s["layers"] if l["type"]=="background"])
    for l in s["layers"]:
      if l["type"]!="symbol": continue
      lo=l.get("layout",{}); pa=l.get("paint",{})
      print(f'  {l["id"]:<26} min {str(l.get("minzoom","-")):<3} size {json.dumps(lo.get("text-size"))[:55]:<55} color {json.dumps(pa.get("text-color"))[:45]:<45} halo {json.dumps(pa.get("text-halo-color"))[:20]} icon {"Y" if "icon-image" in lo else "-"} tt {lo.get("text-transform","-")}')
