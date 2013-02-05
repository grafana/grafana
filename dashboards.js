var dashboards = 
{
  title: "Infinite Monkey Dashboard",
  rows: [
      {
      title:  "Query Control",  
      height: "30px",
      panels: [
        {
          type    : "stringquery",
          span    : 12,
          group   : "main",
          query   : "wine"
        }
      ]
    },
    {
      title:  "Options",
      collapse: true,  
      height: "30px",
      panels: [
        {
          type    : "timepicker",
          span    : 5,
          mode    : 'relative',
          refresh : {
            enable  : false,
            interval: 30,
            min     : 10
          },
          timespan: '1h',
          group   : "main"
        },
        {
          type    : "sort",
          span    : 4,
          group   : "main"
        }
      ]
    },
    {
      title:  "Monkey Monitoring",
      collapse: false,
      height: "300px",
      panels: [
        {
          title   : "Monkey Shakespeare Lines",
          type    : "histogram",
          span    : 6,
          show    : ['lines','points'],
          fill    : 0,
          query   : [
            { label : "Query", query : "*", color: '#86B32D' },
            { label : "Hamlet", query : "play_name:Hamlet" },
            { label : "Macbeth", query : "play_name:macbeth" },
          ],
          group   : "main"
        },
        {
          title   : "Monkey Typists Worldwide",
          type    : "map",
          map     : 'world',
          field   : "country",
          span    : 6,
          size    : 500,
          query   : "*",
          group   : "main"

        }
      ]
    },
    {
      title:  "Lines of Plays",
      height: "250px",
      panels: [
        {
          title   : "Plays",
          type    : "pie",
          span    : 4,
          size    : 8,
          donut   : true,
          colors  : ['#BF3030','#1D7373','#86B32D','#A60000','#006363','#679B00'],
          field   : 'country',
          //query   : { query: "*", field: "country"}
          query   : { field : "play_name", query : "*" },
          group   : "main"
        },
        {
          title   : "Newest Lines",
          type    : "table",
          span    : 8,
          query   : "*",
          fields  : ['@timestamp','play_name','speaker','text_entry'],
          group   : "main"
        }
      ]
    }
  ]
};
