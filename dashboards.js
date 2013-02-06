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
          index   : "\"shakespeare\"",
          refresh : {
            enable  : false,
            interval: 30,
            min     : 10
          },
          timespan : '1h',
          timefield: '@timestamp',
          group: ['default','pies'],
        },
        {
          type    : "sort",
          span    : 4,
        },
        {
          type    : "text",
          fontsize : "85%",
          span: 3,
          content : "Panels can send events to other panels. In the case of" +
            " the sort panel, it also receives a field event that it uses" +
            " to populate its list of fields from the table panel. The time " +
            " selector is a member of two groups."
        },
      ]
    },
    {
      title:  "Top 3 Characters",
      collapse: false,
      height: "160px",
      panels: [
        {
          type    : "text",
          title   : "About",
          fontsize : "85%",
          span: 2,
          content : "These donut charts demonstrate configurable binding." + 
            " They exist in a different group from the other panels and are" +
            " bound only to the time selector, not to the query input. Thus" +
            " they will change when you select a new time range, but not if" +
            " you enter a search.",
        },
        {
          title   : "Hamlet",
          type    : "pie",
          span    : 2,
          size    : 3,
          legend  : false,
          labels  : false,
          donut   : true,
          colors  : ['#20805E','#26527C','#BF8530','#A60000','#006363','#679B00'],
          field   : 'country',
          //query   : { query: "*", field: "country"}
          query   : { field : "speaker", query : "play_name:Hamlet" },
          group   : "pies"
        },
        {
          title   : "Othello",
          type    : "pie",
          span    : 2,
          size    : 3,
          legend  : false,
          labels  : false,
          donut   : true,
          colors  : ['#35D59D','#FFB140','#F43D6B','#A60000','#006363','#679B00'],
          field   : 'country',
          //query   : { query: "*", field: "country"}
          query   : { field : "speaker", query : "play_name:Othello" },
          group   : "pies"
        },
        {
          title   : "A Winters Tale",
          type    : "pie",
          span    : 2,
          size    : 3,
          legend  : false,
          labels  : false,
          donut   : true,
          colors  : ['#78AF2C','#BF4630','#6A237E','#A60000','#006363','#679B00'],
          field   : 'country',
          //query   : { query: "*", field: "country"}
          query   : { field : "speaker", query : 'play_name:"A Winters Tale"' },
          group   : "pies"
        },
        {
          title   : "The Tempest",
          type    : "pie",
          span    : 2,
          size    : 3,
          legend  : false,
          labels  : false,
          donut   : true,
          colors  : ['#2A4480','#BFA730','#BF7130','#A60000','#006363','#679B00'],
          field   : 'country',
          //query   : { query: "*", field: "country"}
          query   : { field : "speaker", query : 'play_name:"The Tempest"' },
          group   : "pies"
        },
        {
          title   : "King Lear",
          type    : "pie",
          span    : 2,
          size    : 3,
          legend  : false,
          labels  : false,
          donut   : true,
          colors  : ['#01939A','#FFAB00','#FF0700','#A60000','#006363','#679B00'],
          field   : 'country',
          //query   : { query: "*", field: "country"}
          query   : { field : "speaker", query : 'play_name:"King Lear"' },
          group   : "pies"
        },
      ]
    },
    {
      title:  "Lines of Plays",
      height: "250px",
      collapse: true,
      panels: [
        {
          title   : "Plays",
          type    : "pie",
          span    : 4,
          size    : 8,
          colors  : ['#BF3030','#1D7373','#86B32D','#A60000','#006363','#679B00'],
          field   : 'country',
          //query   : { query: "*", field: "country"}
          query   : { field : "play_name", query : "*" },
        },
        {
          type    : "text",
          title   : "About",
          fontsize : "85%",
          span: 2,
          content : "The table panel can be sorted via a sort panel, or by" +
            " clicking the table header. Unlike the pie charts above, this" +
            " pie is bound to the query input. Try searching for a speaker" +
            " (eg, FALSTAFF) to see a break down of the plays they appear in.", 
        },
        {
          title   : "Newest Lines",
          type    : "table",
          span    : 6,
          query   : "*",
          fields  : ['@timestamp','play_name','speaker','text_entry'],
        }
      ]
    },
    {
      title:  "Monkey Monitoring",
      collapse: false,
      height: "275px",
      panels: [
        {
          title   : "Monkey Shakespeare Lines",
          type    : "histogram",
          span    : 5,
          show    : ['bars','stack'],
          fill    : 1,
          query   : [
            { label : "Query Hits", query : "*", color: '#86B32D' },
            { label : "Hamlet", query : "play_name:Hamlet" },
            { label : "Macbeth", query : "play_name:macbeth" },
          ],
        },
        {
          title   : "Monkey Typists Worldwide",
          type    : "map",
          map     : 'world',
          field   : "country",
          span    : 5,
          size    : 500,
          query   : "*",
        },
        {
          type    : "text",
          title   : "About",
          fontsize : "85%",
          span: 2,
          content : "Histograms can show multiple queries. In the case that a" +
            " multi-query histogram is bound to a query input, only the first" +
            " data series will be altered. All panels exist in the 'default'" +
            " group by default. The map panel can be used to visualize events" +
            " with attached geo data.", 
        },
      ]
    }
  ]
};
