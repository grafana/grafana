var dashboards = 
{
  title: "Infinite Monkey Dashboard",
  rows: [
    {
      height: "300px",
      panels: [
        {
          title   : "Monkey Shakespeare Lines",
          type    : "histogram",
          span    : 6,
          show    : ['lines','stack'],
          fill    : 1,
          query   : [
            { label : "US", query : "country:US", color: '#86B32D' },
            { label : "CN", query : "country:CN", color: '#BF3030' },
            { label : "IN", query : "country:IN", color: '#1D7373' }
          ],
          color   : "#7BA4AF"
        },
        {
          title   : "World Monkeys",
          type    : "map",
          map     : 'world',
          field   : "country",
          span    : 6,
          size    : 500,
          query   : "*"
        }
      ]
    },
    {
      height: "300px",
      panels: [
        {
          title   : "Hamlet vs Macbeth",
          type    : "pie",
          span    : 4,
          size    : 8,
          donut   : true,
          colors  : ['#BF3030','#1D7373','#86B32D','#A60000','#006363','#679B00'],
          field   : 'country',
          //query   : { query: "*", field: "country"}
          query   : [
            { label : "Hamlet", query : "play_name:Hamlet", color: '#86B32D' },
            { label : "Macbeth", query : "play_name:macbeth", color: '#BF3030' },
          ]
        },
        {
          title   : "Newest Lines",
          type    : "table",
          span    : 8,
          query   : "*",
          fields  : ['@timestamp','speaker','text_entry']
        }
      ]
    }
  ]
};
