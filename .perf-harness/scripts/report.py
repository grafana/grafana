import json,sys
rows={}
for l in open(sys.argv[1]):
  d=json.loads(l); r=d["runs"]
  med=lambda k: sorted(x[k] for x in r)[len(r)//2]
  b,data,z=[s.strip() for s in d["combo"].split("·")]
  rows[(z,data,b)]=dict(ttfr=med("ttfrMs"),tiles=med("tileSpanMs"),heap=med("heapAfterInteractionMB"),p95=med("frameP95"),p99=med("frameP99"),j=med("framesOver50ms"),lt=med("longTaskMs"),req=med("tileRequests"),to=sum(x["timedOut"] for x in r))
print("dupes/len",len(rows))
for (z,data,b),m in rows.items():
  base=rows[(z,data,"CARTO dark-matter" if "dark" in b else "CARTO positron")]
  rt=m["ttfr"]/base["ttfr"]; rh=m["heap"]/base["heap"]
  flag=[]
  if rt>1.5: flag.append("TTFR")
  if rh>2: flag.append("HEAP")
  if m["p95"]>1.5*base["p95"]: flag.append("P95")
  if m["p99"]>base["p99"]+10: flag.append("p99")
  if m["j"]>base["j"]+2: flag.append("jank")
  if m["to"]: flag.append("TIMEOUT")
  print(f'{z:<20}|{data:<13}|{b:<27}|{m["ttfr"]:>5} {rt:4.2f}|{m["heap"]:>6} {rh:4.2f}|p95 {m["p95"]:>5}|p99 {m["p99"]:>5}|j {m["j"]:>3}|lt {m["lt"]:>5}|tiles {m["tiles"]:>5} req {m["req"]:>3}| {" ".join(flag)}')
