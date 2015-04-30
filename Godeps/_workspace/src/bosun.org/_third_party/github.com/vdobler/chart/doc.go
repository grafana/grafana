/*
Package chart implements common chart/plot types.

The following chart types are available:

    StripChart       Visualize set of numeric values
    ScatterChart     Plot (x,y) data (with optional error bars)
                     and/or functions
    HistChart        Produce histograms from data
    BarChart         Show (x,y) data as bars
    BoxChart         Box charts to visualize distributions
    PieChart         Pie and Ring charts

Chart tries to provides useful defaults and produce nice charts without
sacrificing accuracy.  The generated charts look good and are higly
customizable but will not match the visual quality of handmade photoshop
charts or the statistical features of charts produced by S or R.

Creating charts consists of the following steps:
    1. Create chart object
    2. Configure chart, axis, autoscaling etc.
    3. Add one ore more data sets
    4. Render chart to one or more graphic outputs
You may change the configuration at any step or render to different outputs.

The different chart types and their fields are all simple struct types where
the zero value provides suitable defaults.  All fields are exported, even if
you are not supposed to manipulate them directy or are 'output fields'.
E.g. the common Data field of all chart types will store the sample data
added with one or more Add... methods.  Some fields are mere output
which expose internal stuff for your use like the Data2Screen and Screen2Data
functions of the Ranges.  Some fields are even input/output fields:
E.g. you may set the Range.TicSetting.Delta to some positive value which will
be used as the spacing between tics on that axis;  on the other hand if you
leave Range.TicSetting.Delta at its default 0 you indicate to the plotting
routine to automatically determine the tic delta which is then reported
back in this fields.

All charts (except pie/ring charts) contain at least one axis represented by
a field of type Range.  Axis can be differented into following categories:

  o  Date/Time axis (Time=true): The values on this axis are interpreted as
     seconds since the Unix epoc, tics are labeld in date and time units.
     (The Log and Category fields are simply ignored for Date/Time axis.)

  o  Real valued axis (Time=false).  Those come in different flavours:
       -  Simple linear real valued axis (Log=false, Category=nil).
       -  Logrithmic axis (Log=True).  Such an axis may cover only a
          range of ]0,inf[
       -  Categorical axis (Log=false, Category!=nil):
          The values 0, 1, 2, ... are labeled with the strings in Category.
          (You might want to set up the range manually, e.g. with the
          Fixed() method of Range)

How the axis is autoscaled can be controlled for both ends of the axis
individually by MinMode and MaxMode which allow a fine control of the
(auto-) scaling.

After setting up the chart, adding data, samples, functions you can render
the chart to a Graphics output.  This process will set several internal
fields of the chart.  If you reuse the chart, add additional data and
output it again these fields might no longer indicate 'automatical/default'
but contain the value calculated in the first output round.

*/
package chart
