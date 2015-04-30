<Query Kind="Program">
  <Reference>&lt;RuntimeDirectory&gt;\System.Management.dll</Reference>
  <Reference>&lt;RuntimeDirectory&gt;\System.Configuration.Install.dll</Reference>
  <Reference>&lt;RuntimeDirectory&gt;\Microsoft.JScript.dll</Reference>
  <Namespace>System.Management</Namespace>
</Query>

//LinqPad script used to codegen metadata for WMI classes
void Main()
{
	//Follow steps 1-4 to generate the GO code from a wmi class
	//See step 1 at bottom of page.
	string strPrefix = "descWinSystem"; 	//Step 2: Set this to the prefix you want to use for metadata
	string server = "localhost";  		//Step 3: Change this to another server if you need specific WMI information
	string WMIClass = "Win32_PerfRawData_PerfOS_System"; //Step 4: WMI class for which you want to find metadata
	bool GenerateFromMSDNClass = true; //Set to true if using an MSDN class in step 1. Set to false if text is an existing Add/AddTS block of code.
	
	//Load details about WMI Class and properties
	var htWMIDetails = new Dictionary<string,WMIDetail>(StringComparer.InvariantCultureIgnoreCase);
	ManagementScope s = new ManagementScope(string.Format("\\\\{0}\\root\\cimv2", server));
    ManagementPath p = new ManagementPath(WMIClass);
    ObjectGetOptions o = new ObjectGetOptions(null, System.TimeSpan.MaxValue, true);
    ManagementClass osClass = new ManagementClass(s, p, o);
	osClass.Options.UseAmendedQualifiers = true; //Adds Description details (which are missing otherwise)
	//osClass.Properties.Dump();
	foreach (PropertyData property in osClass.Properties)
	{
		WMIDetail d = WMIDetail.FromPropertyData(property);
		//d.Dump();
		htWMIDetails.Add(property.Name, d);
	}
	//htWMIDetails.Values.Dump("WMI Details");
	if(string.IsNullOrWhiteSpace(text)){
		StringBuilder sbText = new StringBuilder();
		foreach(var key in htWMIDetails.Keys){
			sbText.AppendFormat("{0};\r\n",key);
		}
		text = sbText.ToString();
	}
	
	//text.Dump("Input lines pre transform");
	var PropertiesUsed = new List<string>();
	var matches = new List<Match>();
	int countLines = -1;
	using (StringReader sr = new StringReader(text)) {
		string line;
		while ((line = sr.ReadLine()) != null) {
			countLines++;
			if(GenerateFromMSDNClass){
				//Regex to parse metrics out of the class ___ : ____ found on MSDN pages
				var m = Regex.Match(line, @"(?<wmiName>[^ ;\{\}]+);$", RegexOptions.Multiline);
				if(m.Success){
					matches.Add(m);
					PropertiesUsed.Add(m.Groups["wmiName"].Value);
				}
			} else {
				//Regex to parse out the details from an Add or AddTS line in a *_windows.go. Change ""(?<metric>[^"",]*)"" to ""?(?<metric>[^"",]*)""? to capture osXXX based metrics
				var m = Regex.Match(line, @"\s{0,4}Add\(&md, ""(?<metric>[^"",]*)"", v\.(?<wmiName>[a-zA-Z_]*)[^,]*, (nil|opentsdb.TagSet\{(?<tagset>[^}]*)\}), metadata\.(?<type>[^\,]*), metadata\.(?<units>[^\,]*), (""""|[a-zA-Z_]*)\)", RegexOptions.Multiline); //Get wmi details
				if(m.Success){
					matches.Add(m);
					//m.Groups.Dump();
					//m.Groups["tagset"].Value.Dump();
					var t = Regex.Match(m.Groups["tagset"].Value, @"'site': v.Name, '(?<tagkey>[^']*)': '(?<tagvalue>[^']*)'", RegexOptions.Singleline); //Get tag names
					//t.Dump();
					if(t.Success){ //Use different identifier for lines with tags?
						//result.Add(string.Format("{0}_{1}", m.Groups["wmiName"].Value,t.Groups["tagvalue"].Value));
						PropertiesUsed.Add(m.Groups["wmiName"].Value);
					} else {
						PropertiesUsed.Add(m.Groups["wmiName"].Value);
					}				
				}
			}
		}//while
	}//using
	countLines.Dump("Total Lines pre-processing:");
	PropertiesUsed.Distinct().Count().Dump("Distinct WMI Properties detected:");
	//PropertiesUsed.Dump("WMI Properties used in the text block");	
	
	
	if(GenerateFromMSDNClass){
	    //Create lines for adding metric and for the GO struct
		Console.WriteLine("//Metrics:");
		foreach(var m in matches){
			WMIDetail details;
			if(htWMIDetails.TryGetValue(m.Groups["wmiName"].Value, out details)) {
				Console.WriteLine("Add(&md, \"win.system.{0}\", v.{0}, tags, metadata.Counter, metadata.PerSecond, {1}{0})", details.Name,strPrefix);
			}
		}
	}
	
	//Generate const for metadata
	var sb = new StringBuilder("Errors:\r\n");
	Console.WriteLine("\r\nconst (");
	foreach(var wmiproperty in PropertiesUsed){
		WMIDetail details;
		if(htWMIDetails.TryGetValue(wmiproperty, out details)) {
			Console.WriteLine(string.Format("  {2}{0} = \"{1}\"", details.Name,details.Description,strPrefix));
		} else {
		 	sb.AppendLine(string.Format("Could not find WMIDetail for '{0}'. Make sure it matches the WMI Property below. (Case Sensitive)", wmiproperty));
		}
	}
	Console.WriteLine(")\r\n");
	if(sb.Length > 9){
		Console.WriteLine(sb.ToString());
	} 
	
	if(GenerateFromMSDNClass){
		Console.WriteLine("\r\ntype {0} struct {{", WMIClass);
		foreach(var m in matches){
			WMIDetail details;
			if(htWMIDetails.TryGetValue(m.Groups["wmiName"].Value, out details)) {
				Console.WriteLine("  {0} {1}", details.Name, details.CIMTYPE);
			}
		}
		Console.WriteLine("}\r\n");
	} else {
		Console.WriteLine("\r\n//Insert metadata variable to Add/AddTS method call");
		foreach(var m in matches){
			var desc = string.Format("{1}{0}", m.Groups["wmiName"].Value,strPrefix);
			var line = m.Value.Replace("\"\")",""+desc+")");
			line = line.Replace("metadata.Unknown", "metadata.Counter"); //Default to counter, must manually set gauge types.
			Console.WriteLine(line);
		}
	}
	
	Console.WriteLine("\r\n//WMI Counter Types");
	foreach(var m in matches){
		WMIDetail details;
		if(htWMIDetails.TryGetValue(m.Groups["wmiName"].Value, out details)) {
			Console.WriteLine("{0} {1}", details.CounterType, details.Name);
		} else {
			Console.WriteLine("No WMIDetails for {0}", m.Groups["wmiName"].Value);
		}
	} 
	
	htWMIDetails.Values.Dump("WMI Property Details");
}
class WMIDetail {
	public WMIDetail()
	{
	}
	public WMIDetail(string name, string cimtype, string countertype, string description, string displayname)
	{
		this.Name = name;
		this.CIMTYPE = cimtype;
		this.CounterType = countertype;
		this.Description = description;
		this.DisplayName = displayname;
	}
	
	public static WMIDetail FromPropertyData(PropertyData property){
		var result = new WMIDetail();
		result.Name = property.Name;
		foreach(System.Management.QualifierData item in property.Qualifiers){
			switch (item.Name)
			{
				case "CIMTYPE":
					result.CIMTYPE = item.Value.ToString();
					break;
				case "CounterType":
					result.CounterType = item.Value.ToString();
					break;
				case "Description":
					result.Description = item.Value.ToString();
					break;
				case "DisplayName":
					result.DisplayName = item.Value.ToString();
					break;
			}
		}
		return result;
	}
	
	public string Name { get; set; }
	public string CIMTYPE { get; set; }
	public string CounterType { get; set; }
	public string Description { get; set; }
	public string DisplayName { get; set; }
}

//Step 1: Paste MSDN class here. Remove any lines you don't want in your go struct.
//Step 1: Paste current block of GO "Add()" lines here. Then replace " with "" to fix escapping.
string text = @"
  uint32 ExceptionDispatchesPerSec;
  uint64 FileControlBytesPerSec;
  uint32 FileControlOperationsPerSec;
  uint32 FileDataOperationsPerSec;
  uint64 FileReadBytesPerSec;
  uint32 FileReadOperationsPerSec;
";
//Step 1: Or use empty string for all properties
//string text = "";
